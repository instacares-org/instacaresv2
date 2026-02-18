import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// POST - Admin approves or declines a booking extension
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });
    if (adminUser?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { extensionId } = await params;
    const body = await request.json();
    const { action, reason } = body; // action: 'approve' | 'decline'

    if (!action || !['approve', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "approve" or "decline"' },
        { status: 400 }
      );
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
      return NextResponse.json({ error: 'Extension not found' }, { status: 404 });
    }

    if (extension.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Extension is already ${extension.status}, cannot ${action}` },
        { status: 400 }
      );
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

      console.log(`[Admin] Extension ${extensionId} declined by admin ${session.user.id}`);

      // Persistent audit log
      logAuditEvent({
        adminId: session.user.id,
        adminEmail: session.user.email!,
        action: AuditActions.EXTENSION_APPROVED,
        resource: 'bookingExtension',
        resourceId: extensionId,
        details: { decision: 'declined', reason: reason || null, bookingId: extension.bookingId },
        request,
      });

      return NextResponse.json({
        success: true,
        message: 'Extension declined successfully',
        status: 'DECLINED',
      });
    }

    // --- APPROVE ---
    const originalPayment = extension.booking.payments[0];
    if (!originalPayment?.stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'No payment method found for this booking. Cannot charge for extension.' },
        { status: 400 }
      );
    }

    // Get the original payment intent to find customer and payment method
    const originalPaymentIntent = await stripe.paymentIntents.retrieve(
      originalPayment.stripePaymentIntentId
    );

    if (!originalPaymentIntent.payment_method) {
      return NextResponse.json(
        { error: 'No payment method on original payment. Parent must pay manually.' },
        { status: 400 }
      );
    }

    let customerId = originalPaymentIntent.customer as string | null;
    const paymentMethodId = originalPaymentIntent.payment_method as string;

    // Create customer if needed
    if (!customerId) {
      const parentEmail = extension.booking.parent?.email;
      const parentName = extension.booking.parent?.profile
        ? `${extension.booking.parent.profile.firstName || ''} ${extension.booking.parent.profile.lastName || ''}`.trim()
        : undefined;

      const customer = await stripe.customers.create({
        email: parentEmail,
        name: parentName || undefined,
        metadata: {
          userId: extension.booking.parentId,
          source: 'booking_extension_admin_approved'
        }
      });
      customerId = customer.id;

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    }

    // Charge the parent's card
    try {
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
          approvedBy: session.user.id,
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

        console.log(`[Admin] Extension ${extensionId} approved by admin ${session.user.id}. Payment: ${paymentIntent.id}`);

        // Persistent audit log
        logAuditEvent({
          adminId: session.user.id,
          adminEmail: session.user.email!,
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

        return NextResponse.json({
          success: true,
          message: 'Extension approved and payment processed',
          status: 'PAID',
          paymentIntentId: paymentIntent.id,
        });
      } else {
        // Payment requires additional action — mark as pending
        await db.bookingExtension.update({
          where: { id: extensionId },
          data: {
            status: 'PAYMENT_PENDING',
            stripePaymentIntentId: paymentIntent.id,
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Extension approved but payment requires parent confirmation',
          status: 'PAYMENT_PENDING',
        });
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
          message: `The extension was approved but the payment failed. Please update your payment method.`,
          resourceType: 'booking_extension',
          resourceId: extension.id,
        }
      });

      return NextResponse.json({
        success: false,
        error: 'Extension approved but payment failed',
        details: stripeError instanceof Error ? stripeError.message : 'Unknown error',
      }, { status: 402 });
    }

  } catch (error) {
    console.error('Error processing extension approval:', error);
    return NextResponse.json(
      { error: 'Failed to process extension' },
      { status: 500 }
    );
  }
}
