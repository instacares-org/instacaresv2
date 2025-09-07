import { NextRequest, NextResponse } from 'next/server';
import { approvalSchema } from '@/lib/validation';
import { logger, getClientInfo } from '@/lib/logger';
import { prisma, withTransaction } from '@/lib/database';
import { verifyTokenFromRequest } from '@/lib/jwt';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const clientInfo = getClientInfo(request);
  const startTime = Date.now();
  let authResult: any = null;
  let userId: string = '';

  try {
    const paramsData = await params;
    userId = paramsData.userId;

    // Validate admin authentication using session token
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user || tokenResult.user.userType !== 'ADMIN') {
      logger.security('Unauthorized admin approval attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        targetUserId: userId,
        error: 'Invalid admin session'
      });

      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }
    
    authResult = { isValid: true, adminId: tokenResult.user.id };

    // Validate user ID format (basic CUID validation)
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
      logger.warn('Invalid JSON in approval request', { 
        ip: clientInfo.ip,
        adminId: authResult.adminId 
      });
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Validate approval data
    const validationResult = approvalSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(issue => issue.message).join(', ');
      return NextResponse.json(
        { error: `Validation failed: ${errors}` },
        { status: 400 }
      );
    }

    const { action, reason } = validationResult.data;

    // Simple direct update (simplified for debugging)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, approvalStatus: true, userType: true }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
            adminId: authResult.adminId
          });
        } else {
          // User is already approved and has caregiver record - this is truly redundant
          return NextResponse.json(
            { error: 'User already has this approval status' },
            { status: 400 }
          );
        }
      } else {
        // For non-caregiver users or non-approval actions, prevent redundant changes
        return NextResponse.json(
          { error: 'User already has this approval status' },
          { status: 400 }
        );
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
        caregiver: {
          select: {
            id: true
          }
        }
      }
    });

    // If this is a caregiver being approved for the first time, create their caregiver record
    if (action === 'APPROVED' && updatedUser.userType === 'CAREGIVER' && !updatedUser.caregiver) {
      try {
        await prisma.caregiver.create({
          data: {
            userId: userId,
            hourlyRate: 25.0, // Default rate
            experienceYears: 0,
            bio: "New caregiver - profile setup in progress",
            maxChildren: 3,
            minAge: 0, // 0 months (newborn)
            maxAge: 144, // 12 years in months
            isAvailable: true,
            isVerified: false,
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
          adminId: authResult.adminId
        });
      } catch (caregiverCreateError) {
        // Log but don't fail the approval if caregiver creation fails
        logger.error('Failed to auto-create caregiver record', caregiverCreateError, {
          userId: userId,
          email: updatedUser.email,
          adminId: authResult.adminId
        });
      }
    }

    const result = { 
      updatedUser, 
      previousStatus: existingUser.approvalStatus 
    };

    // Audit log for admin action
    logger.audit(isRedundantChange ? 'User re-approval for missing caregiver record' : 'User approval status changed', {
      adminId: authResult.adminId,
      targetUserId: userId,
      targetEmail: result.updatedUser.email,
      action: action,
      previousStatus: result.previousStatus,
      statusActuallyChanged: !isRedundantChange,
      reason: reason || null,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    // Return success response (don't include sensitive data)
    return NextResponse.json({ 
      success: true, 
      message: `User ${action.toLowerCase()} successfully`,
      user: {
        id: result.updatedUser.id,
        email: result.updatedUser.email,
        approvalStatus: result.updatedUser.approvalStatus,
        userType: result.updatedUser.userType,
        profile: result.updatedUser.profile
      }
    });

  } catch (error: any) {
    // Handle specific known errors
    if (error.message === 'USER_NOT_FOUND') {
      logger.warn('Approval attempt for non-existent user', {
        adminId: authResult?.adminId,
        targetUserId: userId,
        ip: clientInfo.ip
      });

      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (error.message === 'STATUS_UNCHANGED') {
      return NextResponse.json(
        { error: 'User already has this approval status' },
        { status: 400 }
      );
    }

    // Log unexpected errors
    logger.error('User approval failed', error, {
      adminId: authResult?.adminId,
      targetUserId: userId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    return NextResponse.json(
      { error: 'Failed to update user approval status' },
      { status: 500 }
    );
  }
}