import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import { logger, getClientInfo } from '@/lib/logger';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const bodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE'], {
    message: 'Invalid status. Must be ACTIVE, SUSPENDED, or INACTIVE',
  }),
  reason: z.string().max(1000, 'Reason too long').optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
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
    permCheck = await requirePermission(request, 'canManageUsers');
    if (!permCheck.authorized) {
      logger.security('Unauthorized user status change attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        targetUserId: userId,
        error: 'Invalid admin session'
      });

      return permCheck.response!;
    }

    // Validate user ID format
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      return ApiErrors.badRequest('Invalid user ID format');
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in user status request', {
        ip: clientInfo.ip,
        adminId: permCheck.user!.id
      });
      return ApiErrors.badRequest('Invalid request format');
    }

    const parsed = bodySchema.safeParse(requestBody);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { status, reason } = parsed.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        userType: true,
        isActive: true,
        approvalStatus: true
      }
    });

    if (!existingUser) {
      return ApiErrors.notFound('User not found');
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: status === 'ACTIVE',
        approvalStatus: status === 'SUSPENDED' ? 'SUSPENDED' : existingUser.approvalStatus,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true,
        approvalStatus: true,
        updatedAt: true,
      }
    });

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: AuditActions.USER_STATUS_CHANGED,
      resource: 'user',
      resourceId: userId,
      details: {
        targetEmail: updatedUser.email,
        previousStatus: existingUser.isActive ? 'ACTIVE' : 'INACTIVE',
        newStatus: status,
        reason: reason || null,
      },
      request,
    });

    // Audit log for admin action
    logger.audit('User status changed', {
      adminId: permCheck.user!.id,
      targetUserId: userId,
      targetEmail: updatedUser.email,
      previousStatus: existingUser.isActive ? 'ACTIVE' : 'INACTIVE',
      newStatus: status,
      reason: reason || null,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    // Return success response
    return apiSuccess({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        userType: updatedUser.userType,
        isActive: updatedUser.isActive,
        approvalStatus: updatedUser.approvalStatus,
        status: status.toLowerCase() // Return friendly status
      }
    }, `User status updated to ${status.toLowerCase()} successfully`);

  } catch (error: any) {
    // Log unexpected errors
    logger.error('User status update failed', error, {
      adminId: permCheck?.user?.id,
      targetUserId: userId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    return ApiErrors.internal('Failed to update user status');
  }
}