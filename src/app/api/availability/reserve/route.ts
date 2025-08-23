import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/jwt';
import { AvailabilityService } from '@/lib/availabilityService';

// POST /api/availability/reserve - Reserve spots temporarily
export async function POST(request: NextRequest) {
  try {
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (tokenResult.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can reserve spots' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { slotId, childrenCount, reservedSpots } = body;

    if (!slotId || !childrenCount || !reservedSpots) {
      return NextResponse.json(
        { error: 'slotId, childrenCount, and reservedSpots are required' },
        { status: 400 }
      );
    }

    const reservation = await AvailabilityService.reserveSpots({
      slotId,
      parentId: tokenResult.user.userId,
      childrenCount,
      reservedSpots
    });

    return NextResponse.json({
      success: true,
      data: reservation,
      message: 'Spots reserved successfully for 15 minutes'
    });

  } catch (error) {
    console.error('Error reserving spots:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to reserve spots'
    }, { status: 500 });
  }
}

// DELETE /api/availability/reserve - Cancel reservation
export async function DELETE(request: NextRequest) {
  try {
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');

    if (!reservationId) {
      return NextResponse.json(
        { error: 'reservationId is required' },
        { status: 400 }
      );
    }

    const reservation = await AvailabilityService.cancelReservation(reservationId);

    return NextResponse.json({
      success: true,
      data: reservation,
      message: 'Reservation cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling reservation:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to cancel reservation'
    }, { status: 500 });
  }
}