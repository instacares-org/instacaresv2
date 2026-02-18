import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// POST - Refund an extension payment
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

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
      return NextResponse.json({ error: 'Extension not found' }, { status: 404 });
    }

    if (extension.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Only paid extensions can be refunded' },
        { status: 400 }
      );
    }

    if (!extension.stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'No payment intent found for this extension' },
        { status: 400 }
      );
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
          adminId: session.user.id
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

      console.log(`[Admin] Extension ${extensionId} refunded by admin ${session.user.id}. Stripe refund: ${refund.id}`);

      // Persistent audit log
      logAuditEvent({
        adminId: session.user.id,
        adminEmail: session.user.email!,
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

      return NextResponse.json({
        success: true,
        message: 'Extension refunded successfully',
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status
        }
      });

    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);
      return NextResponse.json(
        { error: `Stripe refund failed: ${stripeError.message}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
