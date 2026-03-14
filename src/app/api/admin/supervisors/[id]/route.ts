import { NextRequest } from 'next/server';
import { verifyAdminAuth, logAdminAction } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';

const updatePermissionsSchema = z.object({
  permissions: z.object({
    canApproveUsers: z.boolean().optional(),
    canManageUsers: z.boolean().optional(),
    canModerateReviews: z.boolean().optional(),
    canModerateChat: z.boolean().optional(),
    canViewFinancials: z.boolean().optional(),
    canProcessPayouts: z.boolean().optional(),
    canManageExtensions: z.boolean().optional(),
    canViewAnalytics: z.boolean().optional(),
    canViewAuditLogs: z.boolean().optional(),
    canManageSupport: z.boolean().optional(),
    canManageWarnings: z.boolean().optional(),
    canManageNotifications: z.boolean().optional(),
  }),
  isActive: z.boolean().optional(),
});

// GET /api/admin/supervisors/[id] — Get supervisor details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.success || !auth.user) return ApiErrors.unauthorized();

    if (auth.user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only admins can manage supervisors');
    }

    const { id } = await params;

    const supervisor = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: { select: { firstName: true, lastName: true } },
        supervisorPermission: true,
      },
    });

    if (!supervisor || supervisor.userType !== 'SUPERVISOR') {
      return ApiErrors.notFound('Supervisor not found');
    }

    return apiSuccess({
      id: supervisor.id,
      email: supervisor.email,
      isActive: supervisor.isActive,
      createdAt: supervisor.createdAt,
      lastLogin: supervisor.lastLogin,
      profile: supervisor.profile
        ? { firstName: supervisor.profile.firstName, lastName: supervisor.profile.lastName }
        : null,
      permissions: supervisor.supervisorPermission,
    });
  } catch (error) {
    console.error('Error getting supervisor:', error);
    return ApiErrors.internal();
  }
}

// PATCH /api/admin/supervisors/[id] — Update supervisor permissions or status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.success || !auth.user) return ApiErrors.unauthorized();

    if (auth.user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only admins can manage supervisors');
    }

    const { id } = await params;

    // Verify supervisor exists
    const supervisor = await prisma.user.findUnique({
      where: { id },
    });

    if (!supervisor || supervisor.userType !== 'SUPERVISOR') {
      return ApiErrors.notFound('Supervisor not found');
    }

    const body = await request.json();
    const validationResult = updatePermissionsSchema.safeParse(body);

    if (!validationResult.success) {
      return ApiErrors.badRequest('Validation failed', validationResult.error.flatten().fieldErrors);
    }

    const { permissions, isActive } = validationResult.data;

    // Update permissions if provided
    if (permissions) {
      await prisma.supervisorPermission.upsert({
        where: { userId: id },
        update: permissions,
        create: {
          userId: id,
          createdBy: auth.user.id,
          ...permissions,
        },
      });
    }

    // Update active status if provided
    if (isActive !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { isActive },
      });
    }

    logAdminAction({
      adminId: auth.user.id,
      adminEmail: auth.user.email,
      action: isActive === false ? 'deactivate_supervisor' : 'update_supervisor',
      resource: 'supervisor',
      resourceId: id,
      details: { permissions, isActive },
      timestamp: new Date(),
    });

    return apiSuccess(null, 'Supervisor updated successfully');
  } catch (error) {
    console.error('Error updating supervisor:', error);
    return ApiErrors.internal();
  }
}

// DELETE /api/admin/supervisors/[id] — Permanently delete supervisor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.success || !auth.user) return ApiErrors.unauthorized();

    if (auth.user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only admins can manage supervisors');
    }

    const { id } = await params;

    const supervisor = await prisma.user.findUnique({
      where: { id },
      include: { profile: { select: { firstName: true, lastName: true } } },
    });

    if (!supervisor || supervisor.userType !== 'SUPERVISOR') {
      return ApiErrors.notFound('Supervisor not found');
    }

    // Hard delete — remove supervisor permission, profile, and user
    // SupervisorPermission has onDelete: Cascade, so it's deleted with the user
    // Delete profile first (no cascade), then user
    await prisma.$transaction([
      prisma.userProfile.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.supervisorPermission.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    logAdminAction({
      adminId: auth.user.id,
      adminEmail: auth.user.email,
      action: 'delete_supervisor',
      resource: 'supervisor',
      resourceId: id,
      details: {
        email: supervisor.email,
        name: `${supervisor.profile?.firstName || ''} ${supervisor.profile?.lastName || ''}`.trim(),
      },
      timestamp: new Date(),
    });

    return apiSuccess(null, 'Supervisor deleted successfully');
  } catch (error) {
    console.error('Error deleting supervisor:', error);
    return ApiErrors.internal();
  }
}
