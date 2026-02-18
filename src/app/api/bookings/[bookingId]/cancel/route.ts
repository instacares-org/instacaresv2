import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get user type
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get booking with payment info and user details
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        caregiverProfile: {
          select: { stripeAccountId: true }
        },
        parent: {
          select: {
            id: true,
            email: true,
            name: true,
            profile: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        caregiverUser: {
          select: {
            id: true,
            email: true,
            name: true,
            profile: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check authorization
    const isParent = booking.parentId === session.user.id;
    const isCaregiver = booking.caregiverId === session.user.id;
    const isAdmin = user.userType === 'ADMIN';

    if (!isParent && !isCaregiver && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to cancel this booking' }, { status: 403 });
    }

    // Check if booking can be cancelled
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 });
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot cancel a completed booking' }, { status: 400 });
    }

    // Determine who is cancelling
    const cancelledBy = isCaregiver ? 'caregiver' : isParent ? 'parent' : 'admin';

    // Calculate hours before start
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const hoursBeforeStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Calculate refund percentage based on policy
    let refundPercentage: number;
    let refundReason: string;

    if (cancelledBy === 'caregiver') {
      // Caregiver cancels anytime = full refund
      refundPercentage = 100;
      refundReason = 'Caregiver cancelled';
    } else if (cancelledBy === 'parent') {
      if (hoursBeforeStart <= 0) {
        // No-show
        refundPercentage = 0;
        refundReason = 'Parent no-show';
      } else if (hoursBeforeStart < 24) {
        // Less than 24 hours notice
        refundPercentage = 50;
        refundReason = 'Cancelled less than 24 hours before';
      } else {
        // More than 24 hours notice
        refundPercentage = 100;
        refundReason = 'Cancelled more than 24 hours before';
      }
    } else {
      // Admin cancellation - can set custom refund (capped at 0-100%)
      refundPercentage = Math.min(100, Math.max(0, body.refundPercentage ?? 100));
      refundReason = body.adminReason || 'Admin cancellation';
    }

    // Get payment info
    const payment = booking.payments[0];
    let stripeRefundId: string | null = null;
    let refundAmount = 0;
    let platformFeeRefunded = 0;
    let caregiverAmountReversed = 0;

    if (payment && refundPercentage > 0) {
      const originalAmount = payment.amount;
      refundAmount = Math.round(originalAmount * (refundPercentage / 100));

      // Proportional split of platform fee and caregiver amount
      platformFeeRefunded = Math.round(payment.platformFee * (refundPercentage / 100));
      caregiverAmountReversed = Math.round(payment.caregiverPayout * (refundPercentage / 100));

      // Process Stripe refund
      const stripe = getStripeInstance();
      if (stripe && payment.stripePaymentIntentId && !payment.stripePaymentIntentId.startsWith('demo_')) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: refundAmount,
            refund_application_fee: true,  // Refund platform fee proportionally
            reverse_transfer: true,        // Reverse transfer to caregiver
            reason: 'requested_by_customer',
            metadata: {
              bookingId,
              cancelledBy,
              refundPercentage: refundPercentage.toString(),
              reason: refundReason
            }
          });

          stripeRefundId = refund.id;

          logger.info('Stripe refund processed', {
            bookingId,
            refundId: refund.id,
            amount: refundAmount,
            refundPercentage
          });
        } catch (stripeError: any) {
          logger.error('Stripe refund failed', {
            bookingId,
            error: stripeError.message,
            code: stripeError.code
          });

          // If it's a transfer reversal issue, log but continue
          if (stripeError.code === 'charge_already_refunded') {
            return NextResponse.json({ error: 'This booking has already been refunded' }, { status: 400 });
          }

          // For other errors, we might need to handle manually
          // But still proceed with cancellation
        }
      }
    }

    // Create cancellation record and update booking in transaction
    const result = await db.$transaction(async (tx) => {
      // Create cancellation record
      const cancellation = await tx.cancellation.create({
        data: {
          bookingId,
          cancelledBy,
          cancelledByUserId: session.user.id,
          reason: reason || refundReason,
          hoursBeforeStart,
          refundPercentage,
          originalAmount: payment?.amount || 0,
          refundAmount,
          platformFeeRefunded,
          caregiverAmountReversed,
          stripeRefundId,
          status: stripeRefundId ? 'COMPLETED' : (refundPercentage > 0 ? 'PENDING' : 'COMPLETED'),
          isDiscretionary: isAdmin && body.isDiscretionary === true,
          adminNotes: isAdmin ? body.adminNotes : null,
          processedAt: stripeRefundId ? new Date() : null
        }
      });

      // Update booking status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });

      // Update payment status if refund processed
      if (payment && stripeRefundId) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: refundPercentage === 100 ? 'REFUNDED' : 'PAID', // Keep as PAID for partial refunds
            refundedAt: new Date()
          }
        });
      }

      return { cancellation, updatedBooking };
    });

    logger.info('Booking cancelled', {
      bookingId,
      cancelledBy,
      refundPercentage,
      refundAmount,
      userId: session.user.id
    });

    // Send email notifications
    const parentName = booking.parent.profile
      ? `${booking.parent.profile.firstName} ${booking.parent.profile.lastName}`
      : booking.parent.name || 'Parent';
    const caregiverName = booking.caregiverUser.profile
      ? `${booking.caregiverUser.profile.firstName} ${booking.caregiverUser.profile.lastName}`
      : booking.caregiverUser.name || 'Caregiver';
    const bookingDate = new Date(booking.startTime).toLocaleDateString();

    // Send cancellation email to both parties
    try {
      // Email to parent
      if (refundAmount > 0) {
        await emailService.sendRefundNotification(booking.parent.email, {
          bookingId,
          refundAmount: refundAmount / 100,
          refundPercentage,
          reason: refundReason,
          caregiverName,
          bookingDate
        });
      } else {
        await emailService.sendCancellationNotice(booking.parent.email, {
          bookingId,
          cancelledBy,
          reason: reason || refundReason
        });
      }

      // Email to caregiver
      await emailService.sendCancellationNotice(booking.caregiverUser.email, {
        bookingId,
        cancelledBy,
        reason: reason || refundReason
      });

      logger.info('Cancellation emails sent', { bookingId });
    } catch (emailError) {
      // Log but don't fail the request
      logger.error('Failed to send cancellation emails', { bookingId, error: emailError });
    }

    return NextResponse.json({
      success: true,
      data: {
        booking: result.updatedBooking,
        cancellation: result.cancellation,
        refund: {
          percentage: refundPercentage,
          amount: refundAmount / 100, // Convert to dollars
          platformFeeRefunded: platformFeeRefunded / 100,
          caregiverAmountReversed: caregiverAmountReversed / 100,
          stripeRefundId,
          reason: refundReason
        }
      },
      message: refundPercentage > 0
        ? `Booking cancelled. ${refundPercentage}% refund ($${(refundAmount / 100).toFixed(2)}) will be processed.`
        : 'Booking cancelled. No refund will be issued per cancellation policy.'
    });

  } catch (error: any) {
    logger.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking', details: error.message },
      { status: 500 }
    );
  }
}
