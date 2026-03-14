import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// POST - Refund an extension payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> }
) {
  try {
    // Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canManageExtensions');
    if (!permCheck.authorized) return permCheck.response!;

    const { extensionId } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get the extension
    const extension = await db.bookingExtension.findUnique({
      where: { id: extensionId },
      include: {
        booking: {
          include: {
            parent: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } }
              }
            },
            caregiverUser: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } }
              }
            }
          }
        }
      }
    });

    if (!extension) {
      return ApiErrors.notFound('Extension not found');
    }

    if (extension.status !== 'PAID') {
      return ApiErrors.badRequest('Only paid extensions can be refunded');
    }

    if (!extension.stripePaymentIntentId) {
      return ApiErrors.badRequest('No payment intent found for this extension');
    }

    // Resolve Stripe at request time (not module load) for build-time safety
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    // Process refund via Stripe
    try {
      const refund = await stripe.refunds.create({
        payment_intent: extension.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          extensionId: extension.id,
          bookingId: extension.bookingId,
          refundReason: reason || 'Admin initiated refund',
          adminId: permCheck.user!.id
        }
      });

      // Update extension status
      await db.bookingExtension.update({
        where: { id: extensionId },
        data: {
          status: 'CANCELLED',
          reason: `Refunded: ${reason || 'Admin initiated refund'}`,
          updatedAt: new Date()
        }
      });

      // Revert the booking end time to original
      await db.booking.update({
        where: { id: extension.bookingId },
        data: {
          endTime: extension.originalEndTime
        }
      });

      // Create notification for parent
      await db.notification.create({
        data: {
          userId: extension.booking.parentId,
          type: 'PAYMENT',
          title: 'Extension Refunded',
          message: `Your extension charge of $${(extension.extensionAmount / 100).toFixed(2)} has been refunded.${reason ? ` Reason: ${reason}` : ''}`,
          resourceType: 'booking_extension',
          resourceId: extension.id
        }
      });

      // Create notification for caregiver
      await db.notification.create({
        data: {
          userId: extension.booking.caregiverId,
          type: 'BOOKING_UPDATE',
          title: 'Extension Cancelled',
          message: `The booking extension of ${extension.extensionMinutes} minutes has been cancelled and refunded.${reason ? ` Reason: ${reason}` : ''}`,
          resourceType: 'booking_extension',
          resourceId: extension.id
        }
      });

      console.log(`[Admin] Extension ${extensionId} refunded by admin ${permCheck.user!.id}. Stripe refund: ${refund.id}`);

      // Persistent audit log
      logAuditEvent({
        adminId: permCheck.user!.id,
        adminEmail: permCheck.user!.email,
        action: AuditActions.EXTENSION_REFUNDED,
        resource: 'bookingExtension',
        resourceId: extensionId,
        details: {
          bookingId: extension.bookingId,
          refundAmount: refund.amount,
          stripeRefundId: refund.id,
          reason: reason || 'Admin initiated refund',
        },
        request,
      });

      return apiSuccess({
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status
        }
      }, 'Extension refunded successfully');

    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);
      return ApiErrors.internal('Stripe refund failed');
    }

  } catch (error) {
    console.error('Error processing refund:', error);
    return ApiErrors.internal('Failed to process refund');
  }
}
