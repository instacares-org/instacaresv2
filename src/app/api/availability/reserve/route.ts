import { NextRequest } from 'next/server';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth-middleware';
import { AvailabilityService } from '@/lib/availabilityService';

// POST /api/availability/reserve - Reserve spots temporarily
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const body = await request.json();
    const { slotId, childrenCount, reservedSpots } = body;

    if (!slotId || !childrenCount || !reservedSpots) {
      return ApiErrors.badRequest('slotId, childrenCount, and reservedSpots are required');
    }

    const reservation = await AvailabilityService.reserveSpots({
      slotId,
      parentId: authResult.user.id,
      childrenCount,
      reservedSpots
    });

    return apiSuccess(reservation, 'Spots reserved successfully for 15 minutes');

  } catch (error) {
    console.error('Error reserving spots:', error);
    return ApiErrors.internal('Failed to process availability reservation');
  }
}

// DELETE /api/availability/reserve - Cancel reservation
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get('reservationId');

    if (!reservationId) {
      return ApiErrors.badRequest('reservationId is required');
    }

    const reservation = await AvailabilityService.cancelReservation(reservationId);

    return apiSuccess(reservation, 'Reservation cancelled successfully');

  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return ApiErrors.internal('Failed to process availability reservation');
  }
}