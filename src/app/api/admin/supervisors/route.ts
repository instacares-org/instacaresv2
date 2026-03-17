import { NextRequest } from 'next/server';
import { verifyAdminAuth, logAdminAction } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { notificationService } from '@/lib/notifications/notification.service';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSupervisorSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  permissions: z.object({
    canApproveUsers: z.boolean().default(false),
    canManageUsers: z.boolean().default(false),
    canModerateReviews: z.boolean().default(false),
    canModerateChat: z.boolean().default(false),
    canViewFinancials: z.boolean().default(false),
    canProcessPayouts: z.boolean().default(false),
    canManageExtensions: z.boolean().default(false),
    canViewAnalytics: z.boolean().default(false),
    canViewAuditLogs: z.boolean().default(false),
    canManageSupport: z.boolean().default(false),
    canManageWarnings: z.boolean().default(false),
    canManageNotifications: z.boolean().default(false),
  }),
});

// GET /api/admin/supervisors — List all supervisors
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.success || !auth.user) return ApiErrors.unauthorized();

    // Only actual admins can manage supervisors
    if (auth.user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only admins can manage supervisors');
    }

    const supervisors = await prisma.user.findMany({
      where: { userType: 'SUPERVISOR' },
      include: {
        profile: {
          select: { firstName: true, lastName: true },
        },
        supervisorPermission: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = supervisors.map((s) => ({
      id: s.id,
      email: s.email,
      isActive: s.isActive,
      createdAt: s.createdAt,
      lastLogin: s.lastLogin,
      profile: s.profile
        ? { firstName: s.profile.firstName, lastName: s.profile.lastName }
        : null,
      permissions: s.supervisorPermission
        ? {
            canApproveUsers: s.supervisorPermission.canApproveUsers,
            canManageUsers: s.supervisorPermission.canManageUsers,
            canModerateReviews: s.supervisorPermission.canModerateReviews,
            canModerateChat: s.supervisorPermission.canModerateChat,
            canViewFinancials: s.supervisorPermission.canViewFinancials,
            canProcessPayouts: s.supervisorPermission.canProcessPayouts,
            canManageExtensions: s.supervisorPermission.canManageExtensions,
            canViewAnalytics: s.supervisorPermission.canViewAnalytics,
            canViewAuditLogs: s.supervisorPermission.canViewAuditLogs,
            canManageSupport: s.supervisorPermission.canManageSupport,
            canManageWarnings: s.supervisorPermission.canManageWarnings,
            canManageNotifications: s.supervisorPermission.canManageNotifications,
          }
        : null,
    }));

    return apiSuccess({ supervisors: formatted });
  } catch (error) {
    console.error('Error listing supervisors:', error);
    return ApiErrors.internal();
  }
}

// POST /api/admin/supervisors — Create a new supervisor
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.success || !auth.user) return ApiErrors.unauthorized();

    if (auth.user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only admins can create supervisors');
    }

    const body = await request.json();
    const validationResult = createSupervisorSchema.safeParse(body);

    if (!validationResult.success) {
      return ApiErrors.badRequest('Validation failed', validationResult.error.flatten().fieldErrors);
    }

    const { email, password, firstName, lastName, permissions } = validationResult.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return ApiErrors.badRequest('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user + profile + permissions in a transaction
    const supervisor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          userType: 'SUPERVISOR',
          activeRole: 'SUPERVISOR',
          approvalStatus: 'APPROVED',
          isActive: true,
          mustChangePassword: true,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
        },
      });

      await tx.supervisorPermission.create({
        data: {
          userId: user.id,
          createdBy: auth.user!.id,
          ...permissions,
        },
      });

      return user;
    });

    logAdminAction({
      adminId: auth.user.id,
      adminEmail: auth.user.email,
      action: 'create_supervisor',
      resource: 'supervisor',
      resourceId: supervisor.id,
      details: { email, firstName, lastName, permissions },
      timestamp: new Date(),
    });

    // Send welcome email with credentials
    try {
      await notificationService.send({
        userId: supervisor.id,
        type: 'supervisor_welcome',
        data: {
          firstName,
          email,
          tempPassword: password,
          permissions,
        },
        channels: ['email'],
      });
      console.log(`[NOTIFICATION] Sent supervisor welcome email to ${email}`);
    } catch (notifError) {
      console.error('[NOTIFICATION] Error sending supervisor welcome:', notifError);
    }

    return apiSuccess(
      { id: supervisor.id, email: supervisor.email },
      'Supervisor created successfully'
    );
  } catch (error) {
    console.error('Error creating supervisor:', error);
    return ApiErrors.internal();
  }
}
