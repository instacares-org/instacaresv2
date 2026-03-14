import { NextRequest } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { AvailabilityService } from '@/lib/availabilityService';

// GET /api/availability/realtime - Get real-time availability for a caregiver
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');
    const userTimezone = searchParams.get('userTimezone') || 'America/Toronto';

    if (!caregiverId || !date) {
      return ApiErrors.badRequest('caregiverId and date are required');
    }

    const availability = await AvailabilityService.getRealTimeAvailability(
      caregiverId,
      date,
      userTimezone
    );

    return apiSuccess({
      caregiverId,
      date,
      slots: availability,
      totalSlotsAvailable: availability.filter(slot => slot.realTimeAvailable > 0).length,
      totalSpotsAvailable: availability.reduce((sum, slot) => sum + slot.realTimeAvailable, 0)
    });

  } catch (error) {
    console.error('Error fetching real-time availability:', error);
    return ApiErrors.internal('Failed to fetch real-time availability');
  }
}