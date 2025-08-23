import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/availabilityService';

// GET /api/availability/cleanup - Clean up expired reservations
export async function GET(request: NextRequest) {
  try {
    const cleanedCount = await AvailabilityService.cleanupExpiredReservations();

    return NextResponse.json({
      success: true,
      data: {
        cleanedReservations: cleanedCount,
        cleanupTime: new Date().toISOString()
      },
      message: `Cleaned up ${cleanedCount} expired reservations`
    });

  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup expired reservations'
    }, { status: 500 });
  }
}

// This endpoint can be called by a cron job or scheduled task
// For example: every 5 minutes to clean up expired reservations