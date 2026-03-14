import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { AvailabilityService } from '@/lib/availabilityService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { logger, getClientInfo } from '@/lib/logger';
import { DateTime } from 'luxon';
import { getCommissionRate } from '@/lib/stripe';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

// POST /api/bookings/slot-based - Create slot-based booking
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);

  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.BOOKING);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.security('Unauthorized slot-based booking creation attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: 'No session'
      });

      return ApiErrors.unauthorized();
    }

    // Verify user is a parent
    if (session.user.userType !== 'PARENT') {
      logger.security('Non-parent user attempted to create slot-based booking', {
        userId: session.user.id,
        userType: session.user.userType,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });

      return ApiErrors.forbidden('Only parents can create bookings');
    }

    const body = await request.json();
    
    const {
      slotId,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
      reservationId // Optional: if converting from reservation
    } = body;

    // Validate required fields
    if (!slotId || !childrenCount || !address) {
      return ApiErrors.badRequest('Missing required fields', {
        required: ['slotId', 'childrenCount', 'address'],
      });
    }

    // Get slot information to extract booking details
    const slot = await AvailabilityService.getAvailableSlots({ 
      minAvailableSpots: childrenCount
    });
    
    const targetSlot = slot.find(s => s.id === slotId);
    
    if (!targetSlot) {
      return ApiErrors.notFound('Availability slot not found or insufficient capacity');
    }

    // Calculate pricing based on slot information
    // Note: targetSlot.startTime and targetSlot.endTime are already in UTC from database
    const start = new Date(targetSlot.startTime);
    const end = new Date(targetSlot.endTime);
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const hourlyRate = targetSlot.currentRate;
    const subtotal = Math.round(totalHours * hourlyRate * 100); // in cents
    const platformCommissionRate = await getCommissionRate();
    const platformFee = Math.round(subtotal * platformCommissionRate);
    const totalAmount = subtotal;

    // Create slot-based booking
    const booking = await bookingOperations.createBooking({
      parentId: session.user.id,
      caregiverId: targetSlot.caregiver.user.id, // Use the caregiver's user ID
      startTime: start,
      endTime: end,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
      hourlyRate,
      totalHours,
      subtotal,
      platformFee,
      totalAmount,
      slotId, // Include slot ID for slot-based booking
      reservationId // Include reservation ID if converting
    });

    logger.info('Slot-based booking created', {
      bookingId: booking.id,
      parentId: session.user.id,
      caregiverId: targetSlot.caregiver.user.id,
      slotId,
      childrenCount,
      totalAmount,
      ip: clientInfo.ip
    });

    return apiSuccess({
      id: booking.id,
      parentId: booking.parentId,
      caregiverId: booking.caregiverId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      childrenCount: booking.childrenCount,
      totalAmount: booking.totalAmount,
      platformFee: booking.platformFee,
      status: booking.status,
      slotInfo: {
        id: targetSlot.id,
        totalCapacity: targetSlot.totalCapacity,
        remainingCapacity: targetSlot.availableSpots - childrenCount
      },
      createdAt: booking.createdAt,
    }, 'Slot-based booking created successfully', 201);

  } catch (error) {
    console.error('Error creating slot-based booking:', error);

    // Handle specific booking errors
    if (error instanceof Error) {
      if (error.message.includes('Insufficient capacity')) {
        return ApiErrors.conflict('Insufficient capacity');
      }

      if (error.message.includes('not found')) {
        return ApiErrors.notFound('Resource not found');
      }
    }

    return ApiErrors.internal('Failed to create slot-based booking');
  }
}

// GET /api/bookings/slot-based - Get slot-based booking options
export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');
    const minCapacity = searchParams.get('minCapacity') ? parseInt(searchParams.get('minCapacity')!) : 1;

    if (!caregiverId) {
      return ApiErrors.badRequest('Missing required parameter: caregiverId');
    }

    // Build query for available slots
    const query: any = {
      caregiverId,
      minAvailableSpots: minCapacity
    };

    if (date) {
      query.date = new Date(date);
    }

    // Get available slots
    const availableSlots = await AvailabilityService.getAvailableSlots(query);

    // Get commission rate from database
    const commissionRate = await getCommissionRate();

    // Format response with booking options
    const bookingOptions = availableSlots.map(slot => {
      const totalHours = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60);
      const subtotal = Math.round(totalHours * slot.currentRate * 100);
      return {
        slotId: slot.id,
        caregiverId: slot.caregiverId,
        caregiverName: `${slot.caregiver.user.profile?.firstName} ${slot.caregiver.user.profile?.lastName}`,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: slot.totalCapacity,
        availableSpots: slot.availableSpots,
        currentRate: slot.currentRate,
        baseRate: slot.baseRate,
        isDynamicPricing: slot.caregiver.enableDynamicPricing,
        estimatedCost: {
          hourlyRate: slot.currentRate,
          totalHours,
          subtotal,
          platformFee: Math.round(subtotal * commissionRate),
          totalAmount: subtotal
        },
        specialRequirements: slot.specialRequirements,
        notes: slot.notes
      };
    });

    return apiSuccess({
      availableSlots: bookingOptions,
      totalSlots: bookingOptions.length
    });

  } catch (error) {
    console.error('Error fetching slot-based booking options:', error);

    return ApiErrors.internal('Failed to fetch booking options');
  }
}