import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// GET - List all booking extensions with filtering
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canManageExtensions');
    if (!permCheck.authorized) return permCheck.response!;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING, PAID, FAILED, etc.
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const whereClause: any = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Fetch extensions with related data
    const [extensions, total] = await Promise.all([
      db.bookingExtension.findMany({
        where: whereClause,
        include: {
          booking: {
            include: {
              parent: {
                select: {
                  id: true,
                  email: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      phone: true
                    }
                  }
                }
              },
              caregiverUser: {
                select: {
                  id: true,
                  email: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      phone: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.bookingExtension.count({ where: whereClause })
    ]);

    // Get extension statistics
    const stats = await db.bookingExtension.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { extensionAmount: true, platformFee: true }
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = {
        count: s._count.id,
        totalAmount: s._sum.extensionAmount || 0,
        totalPlatformFees: s._sum.platformFee || 0
      };
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number; totalPlatformFees: number }>);

    return apiSuccess({
      extensions: extensions.map(ext => ({
        id: ext.id,
        bookingId: ext.bookingId,
        extensionMinutes: ext.extensionMinutes,
        extensionAmount: ext.extensionAmount,
        platformFee: ext.platformFee,
        caregiverPayout: ext.caregiverPayout,
        hourlyRate: ext.hourlyRate,
        originalEndTime: ext.originalEndTime,
        newEndTime: ext.newEndTime,
        status: ext.status,
        reason: ext.reason,
        stripePaymentIntentId: ext.stripePaymentIntentId,
        paidAt: ext.paidAt,
        reminderCount: ext.reminderCount,
        lastReminderSentAt: ext.lastReminderSentAt,
        createdAt: ext.createdAt,
        parent: {
          id: ext.booking.parent.id,
          email: ext.booking.parent.email,
          name: ext.booking.parent.profile
            ? `${ext.booking.parent.profile.firstName} ${ext.booking.parent.profile.lastName}`
            : 'Unknown',
          phone: ext.booking.parent.profile?.phone
        },
        caregiver: {
          id: ext.booking.caregiverUser.id,
          email: ext.booking.caregiverUser.email,
          name: ext.booking.caregiverUser.profile
            ? `${ext.booking.caregiverUser.profile.firstName} ${ext.booking.caregiverUser.profile.lastName}`
            : 'Unknown',
          phone: ext.booking.caregiverUser.profile?.phone
        },
        booking: {
          id: ext.booking.id,
          date: ext.booking.startTime,
          startTime: ext.booking.startTime,
          endTime: ext.booking.endTime,
          status: ext.booking.status
        }
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      stats: statsMap
    });

  } catch (error) {
    console.error('Error fetching extensions:', error);
    return ApiErrors.internal('Failed to fetch extensions');
  }
}
