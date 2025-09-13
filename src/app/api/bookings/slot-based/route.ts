import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { AvailabilityService } from '@/lib/availabilityService';
// import { // verifyTokenFromRequest } from '@/lib/jwt';
import { logger, getClientInfo } from '@/lib/logger';

// POST /api/bookings/slot-based - Create slot-based booking
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const tokenResult = // verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      logger.security('Unauthorized slot-based booking creation attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: tokenResult.error
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (tokenResult.user.userType !== 'PARENT') {
      logger.security('Non-parent user attempted to create slot-based booking', {
        userId: tokenResult.user.userId,
        userType: tokenResult.user.userType,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return NextResponse.json(
        { error: 'Only parents can create bookings' },
        { status: 403 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['slotId', 'childrenCount', 'address'],
        },
        { status: 400 }
      );
    }

    // Get slot information to extract booking details
    const slot = await AvailabilityService.getAvailableSlots({ 
      minAvailableSpots: childrenCount
    });
    
    const targetSlot = slot.find(s => s.id === slotId);
    
    if (!targetSlot) {
      return NextResponse.json(
        {
          success: false,
          error: 'Availability slot not found or insufficient capacity',
        },
        { status: 404 }
      );
    }

    // Calculate pricing based on slot information
    const start = new Date(targetSlot.startTime);
    const end = new Date(targetSlot.endTime);
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const hourlyRate = targetSlot.currentRate;
    const subtotal = Math.round(totalHours * hourlyRate * 100); // in cents
    const platformCommissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');
    const platformFee = Math.round(subtotal * platformCommissionRate);
    const totalAmount = subtotal;

    // Create slot-based booking
    const booking = await bookingOperations.createBooking({
      parentId: tokenResult.user.userId,
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
      parentId: tokenResult.user.userId,
      caregiverId: targetSlot.caregiver.user.id,
      slotId,
      childrenCount,
      totalAmount,
      ip: clientInfo.ip
    });

    return NextResponse.json({
      success: true,
      data: {
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
      },
      message: 'Slot-based booking created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating slot-based booking:', error);
    
    // Handle specific booking errors
    if (error instanceof Error) {
      if (error.message.includes('Insufficient capacity')) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient capacity',
          message: error.message
        }, { status: 409 }); // Conflict
      }
      
      if (error.message.includes('not found')) {
        return NextResponse.json({
          success: false,
          error: 'Resource not found',
          message: error.message
        }, { status: 404 });
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create slot-based booking',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET /api/bookings/slot-based - Get slot-based booking options
export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const tokenResult = // verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');
    const minCapacity = searchParams.get('minCapacity') ? parseInt(searchParams.get('minCapacity')!) : 1;

    if (!caregiverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: caregiverId',
        },
        { status: 400 }
      );
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

    // Format response with booking options
    const bookingOptions = availableSlots.map(slot => ({
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
        totalHours: (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60),
        subtotal: Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60) * slot.currentRate * 100),
        platformFee: Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60) * slot.currentRate * 100 * 0.15),
        totalAmount: Math.round((new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60) * slot.currentRate * 100)
      },
      specialRequirements: slot.specialRequirements,
      notes: slot.notes
    }));

    return NextResponse.json({
      success: true,
      data: {
        availableSlots: bookingOptions,
        totalSlots: bookingOptions.length
      }
    });

  } catch (error) {
    console.error('Error fetching slot-based booking options:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch booking options',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}