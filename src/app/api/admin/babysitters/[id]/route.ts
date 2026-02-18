import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (adminUser?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

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
      return NextResponse.json(
        { error: 'Babysitter not found' },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};
    let message = '';
    let userUpdateData: Record<string, unknown> = {};

    switch (validatedData.action) {
      case 'approve':
        if (!['PENDING_VERIFICATION', 'DOCUMENTS_SUBMITTED'].includes(babysitter.status)) {
          return NextResponse.json(
            { error: 'Can only approve pending or documents_submitted babysitters' },
            { status: 400 }
          );
        }

        // Verify required documents are present
        if (!babysitter.governmentIdFront || !babysitter.governmentIdBack ||
            !babysitter.policeCheck || !babysitter.selfieForMatch) {
          return NextResponse.json(
            { error: 'Cannot approve: missing required documents (ID, police check, selfie)' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'Cannot reject an already approved babysitter. Use suspend instead.' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'Can only suspend approved babysitters' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'Can only unsuspend suspended babysitters' },
            { status: 400 }
          );
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
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
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
      adminId: session.user.id,
      adminEmail: session.user.email!,
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

    return NextResponse.json({
      success: true,
      message,
      babysitter: {
        id: updatedBabysitter.id,
        status: updatedBabysitter.status,
        approvedAt: updatedBabysitter.approvedAt,
      }
    });

  } catch (error) {
    console.error('Admin babysitter action error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update babysitter' },
      { status: 500 }
    );
  }
}

// GET - Get detailed babysitter info for admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (adminUser?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

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
      return NextResponse.json(
        { error: 'Babysitter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Failed to get babysitter' },
      { status: 500 }
    );
  }
}
