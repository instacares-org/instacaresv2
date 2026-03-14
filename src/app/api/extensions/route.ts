import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/extensions
// Lists PAYMENT_PENDING and FAILED booking extensions for the authenticated
// parent.  The parent dashboard uses this to render actionable payment cards.
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    const userId = (token?.userId as string) || token?.sub;
    if (!userId) {
      return ApiErrors.unauthorized();
    }
    console.log('[Extensions API] Querying extensions for userId:', userId);

    // -----------------------------------------------------------------------
    // First find all bookings where this user is the parent, then query
    // extensions. This two-step approach avoids Prisma relational filter
    // issues with include+select combinations.
    // -----------------------------------------------------------------------
    const parentBookings = await db.booking.findMany({
      where: { parentId: userId },
      select: { id: true },
    });
    const bookingIds = parentBookings.map((b) => b.id);
    console.log('[Extensions API] Parent booking IDs:', bookingIds);

    if (bookingIds.length === 0) {
      console.log('[Extensions API] No bookings found for parent, returning empty');
      return apiSuccess([]);
    }

    const extensions = await db.bookingExtension.findMany({
      where: {
        bookingId: { in: bookingIds },
        status: { in: ['PAYMENT_PENDING', 'FAILED'] },
      },
      include: {
        booking: {
          include: {
            caregiverUser: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // -----------------------------------------------------------------------
    // Shape the response for the frontend.  We flatten caregiver data one
    // level so the component doesn't need to reach deep into the object.
    // -----------------------------------------------------------------------
    const data = extensions.map((ext) => ({
      id: ext.id,
      bookingId: ext.bookingId,
      extensionMinutes: ext.extensionMinutes,
      extensionAmount: ext.extensionAmount,
      hourlyRate: ext.hourlyRate,
      platformFee: ext.platformFee,
      originalEndTime: ext.originalEndTime,
      newEndTime: ext.newEndTime,
      status: ext.status,
      reason: ext.reason,
      createdAt: ext.createdAt,
      booking: {
        id: ext.booking.id,
        startTime: ext.booking.startTime,
        endTime: ext.booking.endTime,
        address: ext.booking.address,
        status: ext.booking.status,
        caregiver: {
          id: ext.booking.caregiverUser.id,
          firstName: ext.booking.caregiverUser.profile?.firstName ?? null,
          lastName: ext.booking.caregiverUser.profile?.lastName ?? null,
          avatarUrl: ext.booking.caregiverUser.profile?.avatar ?? null,
        },
      },
    }));

    console.log('[Extensions API] Found', extensions.length, 'extensions');
    return apiSuccess(data);
  } catch (error) {
    console.error('[Extensions] Error fetching pending extensions:', error);
    return ApiErrors.internal('Failed to fetch pending extensions');
  }
}
