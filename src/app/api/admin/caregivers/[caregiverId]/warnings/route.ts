import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email.service';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// GET - Get all warnings for a caregiver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const permCheck = await requirePermission(request, 'canManageWarnings');
    if (!permCheck.authorized) return permCheck.response!;

    const { caregiverId } = await params;

    const warnings = await db.caregiverWarning.findMany({
      where: { caregiverId },
      orderBy: { createdAt: 'desc' }
    });

    // Count active warnings
    const activeCount = warnings.filter(w => w.isActive).length;

    return apiSuccess({
      warnings,
      activeCount,
      isReviewRequired: activeCount >= 3
    });

  } catch (error) {
    logger.error('Error fetching caregiver warnings:', error);
    return ApiErrors.internal('Failed to fetch warnings');
  }
}

// POST - Issue a new warning to a caregiver
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const permCheck = await requirePermission(request, 'canManageWarnings');
    if (!permCheck.authorized) return permCheck.response!;

    const { caregiverId } = await params;
    const body = await request.json();
    const { warningType, description, bookingId, ticketId, expiresAt } = body;

    // Validate required fields
    if (!warningType || !description) {
      return ApiErrors.badRequest('Warning type and description are required');
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
      return ApiErrors.notFound('Caregiver not found');
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
        issuedBy: permCheck.user!.id,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    logger.info('Caregiver warning issued', {
      caregiverId,
      warningId: warning.id,
      strikeNumber: newStrikeNumber,
      warningType,
      issuedBy: permCheck.user!.id
    });

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email!,
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

    return apiSuccess({
      warning,
      totalActiveWarnings: newStrikeNumber,
      reviewRequired,
      statusUpdated
    }, reviewRequired
      ? `Warning issued. Caregiver has ${newStrikeNumber} active warnings and requires admin review.`
      : `Warning issued. Caregiver now has ${newStrikeNumber} active warning(s).`);

  } catch (error) {
    logger.error('Error issuing caregiver warning:', error);
    return ApiErrors.internal('Failed to issue warning');
  }
}

// DELETE - Deactivate/remove a warning
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    const permCheck = await requirePermission(request, 'canManageWarnings');
    if (!permCheck.authorized) return permCheck.response!;

    const { caregiverId } = await params;
    const { searchParams } = new URL(request.url);
    const warningId = searchParams.get('warningId');

    if (!warningId) {
      return ApiErrors.badRequest('Warning ID is required');
    }

    // Verify warning belongs to this caregiver
    const warning = await db.caregiverWarning.findFirst({
      where: {
        id: warningId,
        caregiverId
      }
    });

    if (!warning) {
      return ApiErrors.notFound('Warning not found');
    }

    // Deactivate warning
    await db.caregiverWarning.update({
      where: { id: warningId },
      data: { isActive: false }
    });

    logger.info('Caregiver warning deactivated', {
      caregiverId,
      warningId,
      deactivatedBy: permCheck.user!.id
    });

    return apiSuccess(undefined, 'Warning deactivated successfully');

  } catch (error) {
    logger.error('Error deactivating warning:', error);
    return ApiErrors.internal('Failed to deactivate warning');
  }
}
