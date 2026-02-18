import { NextRequest, NextResponse } from 'next/server';
import { metrics } from "@/lib/metrics";
import { stripe, getCommissionRate, DEFAULT_COMMISSION_RATE } from '@/lib/stripe';
import { bookingOperations, paymentOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ConfirmPaymentSchema, validateRequest } from '@/lib/api-validation';
import { notificationService } from '@/lib/notifications/notification.service';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const requestBody = await request.json();

    // Validate input using Zod schema
    const validation = validateRequest(ConfirmPaymentSchema, requestBody);

    if (!validation.success) {
      console.error('[SECURITY] Payment confirmation validation failed:', {
        errors: validation.errors,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent')
      });

      return NextResponse.json(
        {
          error: 'Invalid payment confirmation data',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    const { paymentIntentId } = validation.data;

    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Retrieve the payment intent to get its current status
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // If payment is successful, create the booking record
    if (paymentIntent.status === 'succeeded') {
      const metadata = paymentIntent.metadata;

      // Extract booking details from payment metadata
      if (metadata && metadata.bookingDate && metadata.startTime && metadata.endTime) {
        // Parse booking data from metadata
        const bookingDate = metadata.bookingDate;
        const startTime = metadata.startTime;
        const endTime = metadata.endTime;
        const childrenCount = parseInt(metadata.childrenCount || '1');
        const specialRequests = metadata.specialRequests;
        const caregiverName = metadata.caregiverName;

        // TIMEZONE FIX: Interpret times in caregiver's timezone, then convert to UTC for storage
        const { DateTime } = require('luxon');
        const caregiverTimezone = 'America/Toronto'; // Default timezone for Ontario caregivers

        // Times from frontend are in caregiver's local timezone (e.g., "06:00" = 6 AM EST)
        // Create DateTime in caregiver's timezone, then convert to UTC for database storage
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const [year, month, day] = bookingDate.split('-').map(Number);

        const startLocal = DateTime.fromObject({
          year, month, day, hour: startHour, minute: startMin
        }, { zone: caregiverTimezone });

        const endLocal = DateTime.fromObject({
          year, month, day, hour: endHour, minute: endMin
        }, { zone: caregiverTimezone });

        // Convert to JavaScript Date objects (in UTC) for Prisma
        const startDateTime = startLocal.toJSDate();
        const endDateTime = endLocal.toJSDate();

        console.log('🕐 Timezone Conversion:', {
          input: { date: bookingDate, startTime, endTime },
          caregiverTimezone,
          startLocal: startLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
          endLocal: endLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
          startUTC: startDateTime.toISOString(),
          endUTC: endDateTime.toISOString()
        });

        // Calculate amounts from payment intent
        const totalAmount = paymentIntent.amount; // in cents
        const platformCommissionRate = await getCommissionRate();
        const platformFee = paymentIntent.application_fee_amount || Math.round(totalAmount * platformCommissionRate);

        // Calculate hours and hourly rate (hourlyRate stored in dollars, not cents)
        const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
        const hourlyRate = totalHours > 0 ? Math.round((totalAmount / 100) / totalHours) : Math.round(totalAmount / 100);

        try {
          // Find caregiver ID by name (this is a temporary solution - ideally we'd store caregiver ID in metadata)
          const { caregiverOperations } = await import('@/lib/db');

          // For now, we'll need to extract caregiver ID from the booking modal
          // This should be passed in metadata in a real implementation
          let caregiverId = metadata.caregiverId;

          console.log('🔧 PAYMENT CONFIRMATION DEBUG:');
          console.log('- Payment Intent ID:', paymentIntentId);
          console.log('- Metadata caregiverId:', caregiverId);
          console.log('- Metadata caregiverName:', caregiverName);
          console.log('- Full metadata:', metadata);

          // If caregiverId is not in metadata, we need to find it another way
          if (!caregiverId) {
            // Try to find caregiver by name - this is not ideal but works for demo
            const { PrismaClient } = await import('@prisma/client');
            const db = new PrismaClient();

            const caregiver = await db.user.findFirst({
              where: {
                userType: 'CAREGIVER',
                profile: {
                  OR: [
                    { firstName: { contains: caregiverName.split(' ')[0] || '' } },
                    { lastName: { contains: caregiverName.split(' ')[1] || '' } }
                  ]
                }
              },
              include: {
                caregiver: true,
                profile: true
              }
            });

            console.error('Could not find caregiver for booking:', { caregiverName, metadata });
            return NextResponse.json({
              id: paymentIntent.id,
              status: paymentIntent.status,
              amount: paymentIntent.amount,
              metadata: paymentIntent.metadata,
              warning: 'Payment succeeded but booking creation failed - caregiver not found'
            });
          }

          // Create the booking record
          console.log('📝 CREATING BOOKING WITH:');
          console.log('- parentId:', session.user.id);
          console.log('- caregiverId:', caregiverId);
          console.log('- startTime:', startDateTime);
          console.log('- endTime:', endDateTime);
          console.log('- totalAmount:', totalAmount);

          const booking = await bookingOperations.createBooking({
            parentId: session.user.id,
            caregiverId: caregiverId,
            startTime: startDateTime,
            endTime: endDateTime,
            childrenCount: childrenCount,
            address: metadata.address || 'Address not provided',
            latitude: metadata.latitude ? parseFloat(metadata.latitude) : undefined,
            longitude: metadata.longitude ? parseFloat(metadata.longitude) : undefined,
            hourlyRate: hourlyRate,
            totalHours: totalHours,
            subtotal: totalAmount - platformFee,
            platformFee: platformFee,
            totalAmount: totalAmount,
          });

          console.log('Booking created successfully:', booking.id);

          // Create the payment record
          try {
            const caregiverPayout = totalAmount - platformFee;
            const payment = await paymentOperations.createPayment({
              bookingId: booking.id,
              stripePaymentIntentId: paymentIntentId,
              amount: totalAmount,
              platformFee: platformFee,
              caregiverPayout: caregiverPayout,
              status: 'PAID',
            });
            console.log('Payment record created successfully:', payment.id);

            // Update booking status to CONFIRMED now that payment is recorded
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CONFIRMED',
                confirmedAt: new Date()
              }
            });
            console.log('Booking status updated to CONFIRMED');
          } catch (paymentError) {
            console.error('Error creating payment record:', paymentError);
            // Don't fail the entire flow if payment record creation fails
            // The booking was created, which is the most important part
          }

          // Send notifications to both parent and caregiver
          try {
            // Format date for notification
            const { DateTime } = require('luxon');
            const bookingDateFormatted = DateTime.fromJSDate(startDateTime)
              .setZone('America/Toronto')
              .toFormat('MMMM d, yyyy');
            const bookingTimeFormatted = DateTime.fromJSDate(startDateTime)
              .setZone('America/Toronto')
              .toFormat('h:mm a');
            const startTimeFormatted = DateTime.fromJSDate(startDateTime)
              .setZone('America/Toronto')
              .toFormat('h:mm a');
            const endTimeFormatted = DateTime.fromJSDate(endDateTime)
              .setZone('America/Toronto')
              .toFormat('h:mm a');

            // Get caregiver details for notification
            const caregiverUser = await prisma.user.findUnique({
              where: { id: caregiverId },
              include: { profile: true }
            });

            // Build caregiver address for parent drop-off information
            const caregiverAddress = caregiverUser?.profile ?
              [
                caregiverUser.profile.streetAddress,
                caregiverUser.profile.apartment,
                caregiverUser.profile.city,
                caregiverUser.profile.state,
                caregiverUser.profile.zipCode
              ].filter(Boolean).join(', ') : undefined;

            // Get parent details for notification
            const parentUser = await prisma.user.findUnique({
              where: { id: session.user.id },
              include: { profile: true }
            });

            const caregiverFullName = caregiverUser?.profile
              ? `${caregiverUser.profile.firstName} ${caregiverUser.profile.lastName}`
              : caregiverName;

            const parentFullName = parentUser?.profile
              ? `${parentUser.profile.firstName} ${parentUser.profile.lastName}`
              : session.user.name || 'Parent';

            // Fetch children details for the parent (for caregiver notification)
            const parentChildren = await prisma.child.findMany({
              where: { parentId: session.user.id },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                allergies: true,
                medicalConditions: true,
                specialInstructions: true,
              }
            });

            // Calculate age from date of birth
            const childrenWithAge = parentChildren.map(child => {
              const today = new Date();
              const birthDate = new Date(child.dateOfBirth);
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              return {
                firstName: child.firstName,
                lastName: child.lastName || undefined,
                age,
                allergies: child.allergies || undefined,
                medicalConditions: child.medicalConditions || undefined,
                specialInstructions: child.specialInstructions || undefined,
              };
            });

            // Get parent's emergency contact info from profile
            const emergencyContact = parentUser?.profile?.phone ? {
              name: parentFullName,
              phone: parentUser.profile.phone,
              relationship: 'Parent',
            } : undefined;

            // Send confirmation to parent
            console.log('[NOTIFICATION] Sending booking confirmation to parent:', session.user.id);
            await notificationService.send({
              userId: session.user.id,
              type: 'booking_confirmed',
              data: {
                id: booking.id,
                parentName: parentFullName,
                caregiverName: caregiverFullName,
                date: bookingDateFormatted,
                time: bookingTimeFormatted,
                startTime: startTimeFormatted,
                endTime: endTimeFormatted,
                duration: totalHours,
                totalAmount: (totalAmount / 100).toFixed(2),
                childrenCount,
                dropOffAddress: caregiverAddress, // Caregiver's address for drop-off
                address: metadata.address || undefined,
              },
              channels: ['email', 'sms'],
            });

            // Send notification to caregiver with full children details
            console.log('[NOTIFICATION] Sending new booking notification to caregiver:', caregiverId);
            console.log('[NOTIFICATION] Including', childrenWithAge.length, 'children details');
            await notificationService.send({
              userId: caregiverId,
              type: 'new_booking_caregiver',
              data: {
                id: booking.id,
                parentName: parentFullName,
                date: bookingDateFormatted,
                time: bookingTimeFormatted,
                startTime: startTimeFormatted,
                endTime: endTimeFormatted,
                duration: totalHours,
                totalAmount: ((totalAmount - platformFee) / 100).toFixed(2), // Caregiver earnings
                childrenCount,
                children: childrenWithAge,
                emergencyContact,
                address: metadata.address || undefined,
              },
              channels: ['email', 'sms'],
            });

            console.log('[NOTIFICATION] Booking notifications sent successfully');
          } catch (notificationError) {
            // Don't fail the booking if notifications fail
            console.error('[NOTIFICATION] Error sending booking notifications:', notificationError);
          }

          return NextResponse.json({
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            applicationFeeAmount: paymentIntent.application_fee_amount,
            transferData: paymentIntent.transfer_data,
            metadata: paymentIntent.metadata,
            bookingId: booking.id,
            message: 'Payment confirmed and booking created'
          });

        } catch (bookingError) {
          console.error('Error creating booking:', bookingError);
          // Payment succeeded but booking creation failed
          return NextResponse.json({
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            metadata: paymentIntent.metadata,
            error: 'Payment succeeded but booking creation failed',
            details: process.env.NODE_ENV === 'development' ? (bookingError as Error).message : undefined
          }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      applicationFeeAmount: paymentIntent.application_fee_amount,
      transferData: paymentIntent.transfer_data,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment status' },
      { status: 500 }
    );
  }
}
