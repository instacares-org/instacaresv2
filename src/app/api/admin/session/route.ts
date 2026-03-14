import { NextRequest } from 'next/server';
import { verifyAdminAuth, logAdminAction, getAdminPermissions } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// GET /api/admin/session - Get current admin session info
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);

    if (!authResult.success) {
      return ApiErrors.unauthorized();
    }

    const adminUser = authResult.user!;

    // Get full admin user details
    const user = await prisma.user.findUnique({
      where: { id: adminUser.id },
      include: {
        profile: true
      }
    });

    if (!user || !['ADMIN', 'SUPERVISOR'].includes(user.userType)) {
      return ApiErrors.notFound('Admin user not found');
    }

    // Get permissions (async — DB-driven for supervisors)
    const permissions = await getAdminPermissions({ ...adminUser, userType: user.userType });

    // Get recent admin activity (commenting out for now as adminLog table doesn't exist)
    // const recentActivity = await prisma.adminLog.findMany({
    //   where: { adminId: adminUser.id },
    //   orderBy: { createdAt: 'desc' },
    //   take: 10,
    //   select: {
    //     id: true,
    //     action: true,
    //     resource: true,
    //     resourceId: true,
    //     createdAt: true,
    //     ip: true
    //   }
    // }).catch(() => []); // In case the table doesn't exist yet
    const recentActivity: any[] = []; // Temporary placeholder

    // Log session check
    logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'session_check',
      resource: 'admin_session',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      timestamp: new Date()
    });

    return apiSuccess({
      admin: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        profile: user.profile,
        permissions,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      },
      session: {
        authenticated: true,
        permissions,
        recentActivity: recentActivity.length > 0 ? recentActivity : undefined
      }
    });

  } catch (error) {
    console.error('Error getting admin session:', error);
    return ApiErrors.internal();
  }
}

// POST /api/admin/session/extend - Extend admin session
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return ApiErrors.unauthorized();
    }

    const adminUser = authResult.user!;

    // Update last activity
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { lastLogin: new Date() }
    });

    // Log session extension
    logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'session_extend',
      resource: 'admin_session',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      timestamp: new Date()
    });

    return apiSuccess({
      expiresIn: '7d' // JWT token expiry
    }, 'Session extended');

  } catch (error) {
    console.error('Error extending admin session:', error);
    return ApiErrors.internal();
  }
}