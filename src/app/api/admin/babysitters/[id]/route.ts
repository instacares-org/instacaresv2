import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { z } from 'zod';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Validation schema for admin actions
const adminActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'suspend', 'unsuspend']),
  reason: z.string().max(500).optional(),
});

// PATCH - Approve/Reject/Suspend babysitter
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const { id: babysitterId } = await params;
    const body = await request.json();
    const validatedData = adminActionSchema.parse(body);

    // Get the babysitter
    const babysitter = await db.babysitter.findUnique({
      where: { id: babysitterId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter not found');
    }

    let updateData: Record<string, unknown> = {};
    let message = '';
    let userUpdateData: Record<string, unknown> = {};

    switch (validatedData.action) {
      case 'approve':
        if (!['PENDING_VERIFICATION', 'DOCUMENTS_SUBMITTED'].includes(babysitter.status)) {
          return ApiErrors.badRequest('Can only approve pending or documents_submitted babysitters');
        }

        // Verify required documents are present
        if (!babysitter.governmentIdFront || !babysitter.governmentIdBack ||
            !babysitter.policeCheck || !babysitter.selfieForMatch) {
          return ApiErrors.badRequest('Cannot approve: missing required documents (ID, police check, selfie)');
        }

        updateData = {
          status: 'APPROVED',
          approvedAt: new Date(),
        };
        userUpdateData = {
          approvalStatus: 'APPROVED',
        };
        message = 'Babysitter approved successfully';
        break;

      case 'reject':
        if (babysitter.status === 'APPROVED') {
          return ApiErrors.badRequest('Cannot reject an already approved babysitter. Use suspend instead.');
        }

        updateData = {
          status: 'REJECTED',
        };
        userUpdateData = {
          approvalStatus: 'REJECTED',
        };
        message = 'Babysitter application rejected';
        break;

      case 'suspend':
        if (babysitter.status !== 'APPROVED') {
          return ApiErrors.badRequest('Can only suspend approved babysitters');
        }

        updateData = {
          status: 'SUSPENDED',
          isAvailable: false,
        };
        userUpdateData = {
          approvalStatus: 'SUSPENDED',
        };
        message = 'Babysitter suspended';
        break;

      case 'unsuspend':
        if (babysitter.status !== 'SUSPENDED') {
          return ApiErrors.badRequest('Can only unsuspend suspended babysitters');
        }

        updateData = {
          status: 'APPROVED',
          isAvailable: true,
        };
        userUpdateData = {
          approvalStatus: 'APPROVED',
        };
        message = 'Babysitter unsuspended and reactivated';
        break;

      default:
        return ApiErrors.badRequest('Invalid action');
    }

    // Update babysitter
    const updatedBabysitter = await db.babysitter.update({
      where: { id: babysitterId },
      data: updateData
    });

    // Update user approval status
    if (Object.keys(userUpdateData).length > 0) {
      await db.user.update({
        where: { id: babysitter.userId },
        data: userUpdateData
      });
    }

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: AuditActions.BABYSITTER_STATUS_CHANGED,
      resource: 'babysitter',
      resourceId: babysitterId,
      details: {
        babysitterAction: validatedData.action,
        previousStatus: babysitter.status,
        newStatus: updatedBabysitter.status,
        reason: validatedData.reason || null,
      },
      request,
    });

    // TODO: Send email notification to babysitter about status change

    return apiSuccess({
      babysitter: {
        id: updatedBabysitter.id,
        status: updatedBabysitter.status,
        approvedAt: updatedBabysitter.approvedAt,
      }
    }, message);

  } catch (error) {
    console.error('Admin babysitter action error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to update babysitter');
  }
}

// GET - Get detailed babysitter info for admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const { id: babysitterId } = await params;

    const babysitter = await db.babysitter.findUnique({
      where: { id: babysitterId },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        references: true,
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            parent: {
              include: {
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        }
      }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter not found');
    }

    return apiSuccess({
      babysitter: {
        id: babysitter.id,
        userId: babysitter.userId,
        email: babysitter.user.email,
        status: babysitter.status,
        profile: babysitter.user.profile,
        bio: babysitter.bio,
        experienceYears: babysitter.experienceYears,
        experienceSummary: babysitter.experienceSummary,
        hourlyRate: babysitter.hourlyRate,
        documentUrls: {
          governmentIdFront: babysitter.governmentIdFront,
          governmentIdBack: babysitter.governmentIdBack,
          policeCheck: babysitter.policeCheck,
          selfieForMatch: babysitter.selfieForMatch,
          cprCertificate: babysitter.cprCertificate,
          eceCertificate: babysitter.eceCertificate,
        },
        verification: {
          phone: babysitter.phoneVerified,
          email: babysitter.emailVerified,
        },
        references: babysitter.references,
        stripeOnboarded: babysitter.stripeOnboarded,
        stripeConnectId: babysitter.stripeConnectId,
        acceptsOnsitePayment: babysitter.acceptsOnsitePayment,
        stats: {
          totalBookings: babysitter.totalBookings,
          averageRating: babysitter.averageRating,
          totalEarnings: babysitter.totalEarnings / 100,
        },
        recentBookings: babysitter.bookings.map(b => ({
          id: b.id,
          status: b.status,
          startTime: b.startTime,
          endTime: b.endTime,
          totalAmount: b.totalAmount / 100,
          parentName: `${b.parent.profile?.firstName} ${b.parent.profile?.lastName}`,
        })),
        recentReviews: babysitter.reviews,
        createdAt: babysitter.createdAt,
        approvedAt: babysitter.approvedAt,
        lastActiveAt: babysitter.lastActiveAt,
      }
    });

  } catch (error) {
    console.error('Admin get babysitter error:', error);
    return ApiErrors.internal('Failed to get babysitter');
  }
}
