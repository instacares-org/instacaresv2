import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/availabilityService';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

// GET /api/availability/cleanup - Clean up expired reservations
export async function GET(request: NextRequest) {
  try {
    // ✅ STEP 1: Require ADMIN authentication (only admins can trigger cleanup)
    const authResult = await withAuth(request, 'ADMIN');
    if (!authResult.isAuthorized || !authResult.user) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized availability cleanup attempt', {
        endpoint: '/api/availability/cleanup',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const adminUser = authResult.user;

    // ✅ Log admin action for audit trail
    logger.admin('Admin triggered availability cleanup', {
      adminId: adminUser.id,
      adminEmail: adminUser.email
    });

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
    logger.error('Failed to cleanup expired reservations', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup expired reservations'
    }, { status: 500 });
  }
}

// This endpoint can be called by a cron job or scheduled task
// For example: every 5 minutes to clean up expired reservations
