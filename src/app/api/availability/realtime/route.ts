import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/availabilityService';

// GET /api/availability/realtime - Get real-time availability for a caregiver
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');

    if (!caregiverId || !date) {
      return NextResponse.json(
        { error: 'caregiverId and date are required' },
        { status: 400 }
      );
    }

    // Parse date string to local date to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day); // month is 0-indexed
    
    const availability = await AvailabilityService.getRealTimeAvailability(
      caregiverId,
      localDate
    );

    return NextResponse.json({
      success: true,
      data: {
        caregiverId,
        date,
        slots: availability,
        totalSlotsAvailable: availability.filter(slot => slot.realTimeAvailable > 0).length,
        totalSpotsAvailable: availability.reduce((sum, slot) => sum + slot.realTimeAvailable, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching real-time availability:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch real-time availability'
    }, { status: 500 });
  }
}