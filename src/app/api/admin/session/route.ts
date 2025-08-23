import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, logAdminAction, getAdminPermissions } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

// GET /api/admin/session - Get current admin session info
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminUser = authResult.user!;

    // Get full admin user details
    const user = await prisma.user.findUnique({
      where: { id: adminUser.id },
      include: {
        profile: true
      }
    });

    if (!user || user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Get admin permissions
    const permissions = getAdminPermissions(adminUser);

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
      ip: request.ip,
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/session/extend - Extend admin session
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      ip: request.ip,
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Session extended',
      expiresIn: '7d' // JWT token expiry
    });

  } catch (error) {
    console.error('Error extending admin session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}