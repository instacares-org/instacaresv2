import { NextRequest } from 'next/server';
import { approvalSchema } from '@/lib/validation';
import { logger, getClientInfo } from '@/lib/logger';
import { prisma, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { notificationService } from '@/lib/notifications/notification.service';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const clientInfo = getClientInfo(request);
  const startTime = Date.now();
  let userId: string = '';
  let permCheck: any = null;

  try {
    const paramsData = await params;
    userId = paramsData.userId;

    // Validate admin authentication and permission
    permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) {
      logger.security('Unauthorized admin approval attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        targetUserId: userId,
        error: 'Invalid admin session'
      });

      return permCheck.response!;
    }

    // Validate user ID format (basic CUID validation)
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      return ApiErrors.badRequest('Invalid user ID format');
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in approval request', {
        ip: clientInfo.ip,
        adminId: permCheck.user!.id
      });
      return ApiErrors.badRequest('Invalid request format');
    }

    // Validate approval data
    const validationResult = approvalSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(issue => issue.message).join(', ');
      return ApiErrors.badRequest(`Validation failed: ${errors}`);
    }

    const { action, reason } = validationResult.data;

    // Simple direct update (simplified for debugging)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, approvalStatus: true, userType: true, profile: { select: { firstName: true } } }
    });

    if (!existingUser) {
      return ApiErrors.notFound('User not found');
    }

    // Check for redundant status changes, but allow re-approval if caregiver record is missing
    const isRedundantChange = existingUser.approvalStatus === action;

    if (isRedundantChange) {
      // Special case: If this is a caregiver being "re-approved" and they don't have a caregiver record,
      // we should still proceed to create the missing caregiver record
      if (action === 'APPROVED' && existingUser.userType === 'CAREGIVER') {
        const existingCaregiver = await prisma.caregiver.findUnique({
          where: { userId: userId },
          select: { id: true }
        });

        if (!existingCaregiver) {
          logger.warn('Re-approving caregiver with missing caregiver record', {
            userId: userId,
            email: existingUser.email,
            adminId: permCheck.user!.id
          });
        } else {
          // User is already approved and has caregiver record - this is truly redundant
          return ApiErrors.badRequest('User already has this approval status');
        }
      } else {
        // For non-caregiver users or non-approval actions, prevent redundant changes
        return ApiErrors.badRequest('User already has this approval status');
      }
    }

    // Update user approval status and create caregiver record if needed
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: isRedundantChange ? {
        // For redundant changes, just update the timestamp to trigger the caregiver creation check
        updatedAt: new Date(),
      } : {
        // For actual status changes, update both status and timestamp
        approvalStatus: action,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        userType: true,
        approvalStatus: true,
        updatedAt: true,
        isBabysitter: true,
        caregiver: {
          select: {
            id: true
          }
        },
        babysitter: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    // If this is a caregiver being approved, ensure they are verified
    if (action === 'APPROVED' && updatedUser.userType === 'CAREGIVER') {
      if (updatedUser.caregiver) {
        // Update existing caregiver to be verified and available
        await prisma.caregiver.update({
          where: { userId: userId },
          data: {
            isVerified: true,
            isAvailable: true  // Enable caregiver to appear in search results
          }
        });
        logger.info('Set isVerified=true and isAvailable=true for existing caregiver', {
          userId: userId,
          caregiverId: updatedUser.caregiver.id
        });
      } else {
        try {
          await prisma.caregiver.create({
            data: {
              userId: userId,
              hourlyRate: 25.0,
              experienceYears: 0,
              bio: "New caregiver - profile setup in progress",
              maxChildren: 3,
              minAge: 0,
              maxAge: 144,
              isAvailable: true,
              isVerified: true,
              backgroundCheck: false,
              stripeOnboarded: false,
              canReceivePayments: false,
              totalBookings: 0,
              totalEarnings: 0,
            }
          });

          logger.info('Auto-created caregiver record for approved user', {
            userId: userId,
            email: updatedUser.email,
            adminId: permCheck.user!.id
          });

          // Fix profile data for newly approved caregiver
          const profile = await prisma.userProfile.findUnique({
            where: { userId: userId }
          });

          if (profile) {
            const updates: any = {};
            if (profile.country === "Canada" || profile.country === "canada") {
              updates.country = "CA";
            }
            if (Object.keys(updates).length > 0) {
              await prisma.userProfile.update({
                where: { userId: userId },
                data: updates
              });
              logger.info('Fixed profile data during admin approval', { userId, updates });
            }
          }
        } catch (caregiverCreateError) {
          logger.error('Failed to auto-create caregiver record', caregiverCreateError, {
            userId: userId,
            email: updatedUser.email,
            adminId: permCheck.user!.id
          });
        }
      }
    }

    // If user is a babysitter, sync babysitter record status (or create if missing)
    if (updatedUser.isBabysitter || updatedUser.userType === 'BABYSITTER') {
      const babysitterStatusMap: Record<string, 'APPROVED' | 'REJECTED' | 'SUSPENDED'> = {
        'APPROVED': 'APPROVED',
        'REJECTED': 'REJECTED',
        'SUSPENDED': 'SUSPENDED',
      };
      const newBabysitterStatus = babysitterStatusMap[action];

      if (updatedUser.babysitter) {
        // Update existing babysitter record
        if (newBabysitterStatus && updatedUser.babysitter.status !== newBabysitterStatus) {
          await prisma.babysitter.update({
            where: { id: updatedUser.babysitter.id },
            data: {
              status: newBabysitterStatus,
              ...(action === 'APPROVED' ? { approvedAt: new Date(), isAvailable: true } : {}),
              ...(action === 'SUSPENDED' ? { isAvailable: false } : {}),
            }
          });
          logger.info('Synced babysitter status with user approval', {
            userId,
            babysitterId: updatedUser.babysitter.id,
            previousStatus: updatedUser.babysitter.status,
            newStatus: newBabysitterStatus,
          });
        }
      } else if (action === 'APPROVED') {
        // Auto-create babysitter record if missing (e.g., OAuth signup)
        try {
          await prisma.babysitter.create({
            data: {
              userId: userId,
              bio: '',
              experienceYears: 0,
              hourlyRate: 20,
              status: 'APPROVED',
              approvedAt: new Date(),
              isAvailable: true,
              phoneVerified: false,
              emailVerified: false,
            }
          });
          logger.info('Auto-created babysitter record for approved user', {
            userId,
            email: updatedUser.email,
            adminId: permCheck.user!.id,
          });
        } catch (babysitterCreateError) {
          logger.error('Failed to auto-create babysitter record', babysitterCreateError, {
            userId,
            email: updatedUser.email,
          });
        }
      }
    }

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: action === 'APPROVED' ? AuditActions.USER_APPROVED : AuditActions.USER_REJECTED,
      resource: 'user',
      resourceId: userId,
      details: {
        targetEmail: updatedUser.email,
        previousStatus: existingUser.approvalStatus,
        newStatus: action,
        reason: reason || null,
      },
      request,
    });

    // Audit log for admin action
    logger.audit(isRedundantChange ? 'User re-approval for missing caregiver record' : 'User approval status changed', {
      adminId: permCheck.user!.id,
      targetUserId: userId,
      targetEmail: updatedUser.email,
      action: action,
      previousStatus: existingUser.approvalStatus,
      statusActuallyChanged: !isRedundantChange,
      reason: reason || null,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    // Send approval/rejection email notification
    try {
      const firstName = existingUser.profile?.firstName || 'User';
      await notificationService.send({
        userId: userId,
        type: action === 'APPROVED' ? 'account_approved' : 'account_rejected',
        data: {
          firstName,
          userType: existingUser.userType,
          reason: reason || undefined,
        },
        channels: ['email'],
      });
      console.log(`[NOTIFICATION] Sent ${action.toLowerCase()} email to ${updatedUser.email}`);
    } catch (notifError) {
      console.error('[NOTIFICATION] Error sending approval notification:', notifError);
    }

    // Return success response (don't include sensitive data)
    return apiSuccess({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        approvalStatus: updatedUser.approvalStatus,
        userType: updatedUser.userType
      }
    }, `User ${action.toLowerCase()} successfully`);

  } catch (error: any) {
    // Handle specific known errors
    if (error.message === 'USER_NOT_FOUND') {
      logger.warn('Approval attempt for non-existent user', {
        adminId: permCheck?.user?.id,
        targetUserId: userId,
        ip: clientInfo.ip
      });

      return ApiErrors.notFound('User not found');
    }

    if (error.message === 'STATUS_UNCHANGED') {
      return ApiErrors.badRequest('User already has this approval status');
    }

    // Log unexpected errors
    logger.error('User approval failed', error, {
      adminId: permCheck?.user?.id,
      targetUserId: userId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    return ApiErrors.internal('Failed to update user approval status');
  }
}