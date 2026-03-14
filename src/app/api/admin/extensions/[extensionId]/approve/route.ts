import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

// POST - Admin approves or declines a booking extension
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
    const { action, reason } = body; // action: 'approve' | 'decline'

    if (!action || !['approve', 'decline'].includes(action)) {
      return ApiErrors.badRequest('Action must be "approve" or "decline"');
    }

    // Get the extension with booking and payment data
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
            },
            payments: {
              where: { status: 'PAID' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!extension) {
      return ApiErrors.notFound('Extension not found');
    }

    if (extension.status !== 'PENDING') {
      return ApiErrors.badRequest(`Extension is already ${extension.status}, cannot ${action}`);
    }

    // --- DECLINE ---
    if (action === 'decline') {
      await db.bookingExtension.update({
        where: { id: extensionId },
        data: {
          status: 'DECLINED',
          reason: reason || 'Declined by admin',
        }
      });

      // Notify parent
      await db.notification.create({
        data: {
          userId: extension.booking.parentId,
          type: 'BOOKING_UPDATE',
          title: 'Extension Request Declined',
          message: `The ${extension.extensionMinutes}-minute extension request for your booking has been declined.${reason ? ` Reason: ${reason}` : ''}`,
          resourceType: 'booking_extension',
          resourceId: extension.id,
        }
      });

      // Notify caregiver
      await db.notification.create({
        data: {
          userId: extension.booking.caregiverId,
          type: 'BOOKING_UPDATE',
          title: 'Extension Request Declined',
          message: `Your ${extension.extensionMinutes}-minute extension request has been declined by admin.${reason ? ` Reason: ${reason}` : ''}`,
          resourceType: 'booking_extension',
          resourceId: extension.id,
        }
      });

      console.log(`[Admin] Extension ${extensionId} declined by admin ${permCheck.user!.id}`);

      // Persistent audit log
      logAuditEvent({
        adminId: permCheck.user!.id,
        adminEmail: permCheck.user!.email,
        action: AuditActions.EXTENSION_APPROVED,
        resource: 'bookingExtension',
        resourceId: extensionId,
        details: { decision: 'declined', reason: reason || null, bookingId: extension.bookingId },
        request,
      });

      return apiSuccess({
        status: 'DECLINED',
      }, 'Extension declined successfully');
    }

    // --- APPROVE ---
    const originalPayment = extension.booking.payments[0];
    if (!originalPayment?.stripePaymentIntentId) {
      return ApiErrors.badRequest('No payment method found for this booking. Cannot charge for extension.');
    }

    // Resolve Stripe at request time (not module load) for build-time safety
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    // Charge the parent's card
    try {
      // Get the original payment intent to find customer and payment method
      const originalPaymentIntent = await stripe.paymentIntents.retrieve(
        originalPayment.stripePaymentIntentId
      );

      let customerId = originalPaymentIntent.customer as string | null;
      let paymentMethodId = originalPaymentIntent.payment_method as string | null;

      // If no customer on the original PI, check if the parent has a saved Stripe customer
      if (!customerId) {
        const parentUser = await db.user.findUnique({
          where: { id: extension.booking.parentId },
          select: { stripeCustomerId: true },
        });
        customerId = parentUser?.stripeCustomerId || null;
      }

      // If we have a customer, try to find a usable payment method on that customer
      if (customerId) {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
          limit: 1,
        });
        if (paymentMethods.data.length > 0) {
          paymentMethodId = paymentMethods.data[0].id;
        }
      }

      // If we still have no customer or no usable payment method, we can't charge off-session
      if (!customerId || !paymentMethodId) {
        await db.bookingExtension.update({
          where: { id: extensionId },
          data: { status: 'PAYMENT_PENDING' },
        });

        await db.notification.create({
          data: {
            userId: extension.booking.parentId,
            type: 'PAYMENT_FAILED',
            title: 'Extension Approved — Payment Required',
            message: `The ${extension.extensionMinutes}-minute extension has been approved. Please visit your dashboard to complete the payment of $${(extension.extensionAmount / 100).toFixed(2)}.`,
            resourceType: 'booking_extension',
            resourceId: extension.id,
          },
        });

        console.log(`[Admin] Extension ${extensionId} approved but no reusable payment method. Notified parent.`);

        logAuditEvent({
          adminId: permCheck.user!.id,
          adminEmail: permCheck.user!.email,
          action: AuditActions.EXTENSION_APPROVED,
          resource: 'bookingExtension',
          resourceId: extensionId,
          details: { decision: 'approved', paymentPending: true, bookingId: extension.bookingId },
          request,
        });

        return apiSuccess({
          status: 'PAYMENT_PENDING',
        }, 'Extension approved but no saved payment method. Parent has been notified to pay.');
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: extension.extensionAmount,
        currency: 'cad',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          type: 'booking_extension',
          extensionId: extension.id,
          bookingId: extension.bookingId,
          extensionMinutes: extension.extensionMinutes.toString(),
          caregiverId: extension.booking.caregiverId,
          parentId: extension.booking.parentId,
          approvedBy: permCheck.user!.id,
        },
        description: `Booking extension: ${extension.extensionMinutes} minutes (admin approved)`,
      });

      if (paymentIntent.status === 'succeeded') {
        // Update extension as paid
        await db.bookingExtension.update({
          where: { id: extensionId },
          data: {
            status: 'PAID',
            stripePaymentIntentId: paymentIntent.id,
            paidAt: new Date(),
          }
        });

        const extensionHours = extension.extensionMinutes / 60;

        // Update the booking totals
        await db.booking.update({
          where: { id: extension.bookingId },
          data: {
            endTime: extension.newEndTime,
            totalHours: extension.booking.totalHours + extensionHours,
            subtotal: extension.booking.subtotal + extension.extensionAmount,
            platformFee: extension.booking.platformFee + extension.platformFee,
            totalAmount: extension.booking.totalAmount + extension.extensionAmount,
          }
        });

        // Notify parent
        await db.notification.create({
          data: {
            userId: extension.booking.parentId,
            type: 'PAYMENT_RECEIVED',
            title: 'Extension Approved & Payment Processed',
            message: `The ${extension.extensionMinutes}-minute extension has been approved. $${(extension.extensionAmount / 100).toFixed(2)} has been charged to your card.`,
            resourceType: 'booking_extension',
            resourceId: extension.id,
          }
        });

        // Notify caregiver
        await db.notification.create({
          data: {
            userId: extension.booking.caregiverId,
            type: 'BOOKING_UPDATE',
            title: 'Extension Approved',
            message: `Your ${extension.extensionMinutes}-minute extension request has been approved. The booking has been extended.`,
            resourceType: 'booking_extension',
            resourceId: extension.id,
          }
        });

        console.log(`[Admin] Extension ${extensionId} approved by admin ${permCheck.user!.id}. Payment: ${paymentIntent.id}`);

        // Persistent audit log
        logAuditEvent({
          adminId: permCheck.user!.id,
          adminEmail: permCheck.user!.email,
          action: AuditActions.EXTENSION_APPROVED,
          resource: 'bookingExtension',
          resourceId: extensionId,
          details: {
            decision: 'approved',
            bookingId: extension.bookingId,
            amount: extension.extensionAmount,
            minutes: extension.extensionMinutes,
            stripePaymentIntentId: paymentIntent.id,
          },
          request,
        });

        return apiSuccess({
          status: 'PAID',
          paymentIntentId: paymentIntent.id,
        }, 'Extension approved and payment processed');
      } else {
        // Payment requires additional action — mark as pending
        await db.bookingExtension.update({
          where: { id: extensionId },
          data: {
            status: 'PAYMENT_PENDING',
            stripePaymentIntentId: paymentIntent.id,
          }
        });

        return apiSuccess({
          status: 'PAYMENT_PENDING',
        }, 'Extension approved but payment requires parent confirmation');
      }
    } catch (stripeError: unknown) {
      console.error('[Admin] Stripe payment error for extension approval:', stripeError);

      await db.bookingExtension.update({
        where: { id: extensionId },
        data: { status: 'FAILED' }
      });

      // Notify parent of failure
      await db.notification.create({
        data: {
          userId: extension.booking.parentId,
          type: 'PAYMENT_FAILED',
          title: 'Extension Payment Failed',
          message: `The extension was approved but the payment failed. Please visit your dashboard to retry the payment.`,
          resourceType: 'booking_extension',
          resourceId: extension.id,
        }
      });

      return apiError('Extension approved but payment failed', 402);
    }

  } catch (error) {
    console.error('Error processing extension approval:', error);
    return ApiErrors.internal('Failed to process extension');
  }
}
