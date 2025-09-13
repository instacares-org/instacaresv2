import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { logger, getClientInfo } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const clientInfo = getClientInfo(request);
  const startTime = Date.now();
  let userId: string = '';
  let authResult: any = null;

  try {
    const paramsData = await params;
    userId = paramsData.userId;

    // Validate admin authentication
    authResult = await withAuth(request, 'ADMIN', true);
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized user status change attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        targetUserId: userId,
        error: 'Invalid admin session'
      });
      
      return authResult.response;
    }

    // Validate user ID format
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in user status request', { 
        ip: clientInfo.ip,
        adminId: authResult.user?.id 
      });
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { status, reason } = requestBody;

    // Validate status
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be ACTIVE, SUSPENDED, or INACTIVE' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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

    // Audit log for admin action
    logger.audit('User status changed', {
      adminId: authResult.user?.id,
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
    return NextResponse.json({ 
      success: true, 
      message: `User status updated to ${status.toLowerCase()} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        userType: updatedUser.userType,
        isActive: updatedUser.isActive,
        approvalStatus: updatedUser.approvalStatus,
        status: status.toLowerCase() // Return friendly status
      }
    });

  } catch (error: any) {
    // Log unexpected errors
    logger.error('User status update failed', error, {
      adminId: authResult?.user?.id,
      targetUserId: userId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}