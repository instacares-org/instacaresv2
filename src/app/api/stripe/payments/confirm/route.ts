import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { bookingOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Retrieve the payment intent to get its current status
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
        
        // Create full datetime objects
        const startDateTime = new Date(`${bookingDate}T${startTime}:00`);
        const endDateTime = new Date(`${bookingDate}T${endTime}:00`);
        
        // Calculate duration and rates
        const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
        const totalAmount = paymentIntent.amount; // amount in cents
        const hourlyRate = Math.round(totalAmount / (totalHours * 100)); // convert back to dollars
        const platformCommissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');
        const platformFee = Math.round(totalAmount * platformCommissionRate);

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
          console.log('- User ID from token:', session.user.id);
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
            
            caregiverId = caregiver?.id;
            await db.$disconnect();
          }

          if (!caregiverId) {
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
            specialRequests: specialRequests,
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