import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email.service';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

// GET - Get all warnings for a caregiver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { caregiverId } = await params;

    const warnings = await db.caregiverWarning.findMany({
      where: { caregiverId },
      orderBy: { createdAt: 'desc' }
    });

    // Count active warnings
    const activeCount = warnings.filter(w => w.isActive).length;

    return NextResponse.json({
      success: true,
      data: {
        warnings,
        activeCount,
        isReviewRequired: activeCount >= 3
      }
    });

  } catch (error) {
    logger.error('Error fetching caregiver warnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warnings' },
      { status: 500 }
    );
  }
}

// POST - Issue a new warning to a caregiver
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { caregiverId } = await params;
    const body = await request.json();
    const { warningType, description, bookingId, ticketId, expiresAt } = body;

    // Validate required fields
    if (!warningType || !description) {
      return NextResponse.json(
        { error: 'Warning type and description are required' },
        { status: 400 }
      );
    }

    // Verify caregiver exists
    const caregiver = await db.caregiver.findUnique({
      where: { id: caregiverId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            approvalStatus: true
          }
        }
      }
    });

    if (!caregiver) {
      return NextResponse.json({ error: 'Caregiver not found' }, { status: 404 });
    }

    // Count existing active warnings
    const activeWarnings = await db.caregiverWarning.count({
      where: {
        caregiverId,
        isActive: true
      }
    });

    const newStrikeNumber = activeWarnings + 1;

    // Create warning
    const warning = await db.caregiverWarning.create({
      data: {
        caregiverId,
        warningType,
        description,
        bookingId: bookingId || null,
        ticketId: ticketId || null,
        strikeNumber: newStrikeNumber,
        issuedBy: session.user.id,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    logger.info('Caregiver warning issued', {
      caregiverId,
      warningId: warning.id,
      strikeNumber: newStrikeNumber,
      warningType,
      issuedBy: session.user.id
    });

    // Persistent audit log
    logAuditEvent({
      adminId: session.user.id,
      adminEmail: session.user.email!,
      action: AuditActions.CAREGIVER_WARNING_ISSUED,
      resource: 'caregiver',
      resourceId: caregiverId,
      details: {
        warningId: warning.id,
        warningType,
        strikeNumber: newStrikeNumber,
        description,
        bookingId: bookingId || null,
      },
      request,
    });

    // Check if 3rd strike - flag for admin review
    let reviewRequired = false;
    let statusUpdated = false;

    if (newStrikeNumber >= 3) {
      reviewRequired = true;

      // Optionally suspend the caregiver automatically
      // For now, just flag for review (manual action required)
      logger.warn('Caregiver reached 3 strikes - review required', {
        caregiverId,
        caregiverEmail: caregiver.user.email,
        totalStrikes: newStrikeNumber
      });

      // Update user approval status to indicate review needed
      // You could also suspend them automatically here
      // await db.user.update({
      //   where: { id: caregiver.user.id },
      //   data: { approvalStatus: 'SUSPENDED' }
      // });
      // statusUpdated = true;
    }

    // Send warning email to caregiver
    try {
      await emailService.sendCaregiverWarning(caregiver.user.email, {
        warningType,
        description,
        strikeNumber: newStrikeNumber,
        bookingId
      });
      logger.info('Warning email sent to caregiver', { caregiverId, email: caregiver.user.email });
    } catch (emailError) {
      logger.error('Failed to send warning email', { caregiverId, error: emailError });
    }

    return NextResponse.json({
      success: true,
      data: {
        warning,
        totalActiveWarnings: newStrikeNumber,
        reviewRequired,
        statusUpdated
      },
      message: reviewRequired
        ? `Warning issued. Caregiver has ${newStrikeNumber} active warnings and requires admin review.`
        : `Warning issued. Caregiver now has ${newStrikeNumber} active warning(s).`
    });

  } catch (error) {
    logger.error('Error issuing caregiver warning:', error);
    return NextResponse.json(
      { error: 'Failed to issue warning' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate/remove a warning
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { caregiverId } = await params;
    const { searchParams } = new URL(request.url);
    const warningId = searchParams.get('warningId');

    if (!warningId) {
      return NextResponse.json({ error: 'Warning ID is required' }, { status: 400 });
    }

    // Verify warning belongs to this caregiver
    const warning = await db.caregiverWarning.findFirst({
      where: {
        id: warningId,
        caregiverId
      }
    });

    if (!warning) {
      return NextResponse.json({ error: 'Warning not found' }, { status: 404 });
    }

    // Deactivate warning
    await db.caregiverWarning.update({
      where: { id: warningId },
      data: { isActive: false }
    });

    logger.info('Caregiver warning deactivated', {
      caregiverId,
      warningId,
      deactivatedBy: session.user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Warning deactivated successfully'
    });

  } catch (error) {
    logger.error('Error deactivating warning:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate warning' },
      { status: 500 }
    );
  }
}
