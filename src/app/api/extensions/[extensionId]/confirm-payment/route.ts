import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
});

// =============================================================================
// POST /api/extensions/[extensionId]/confirm-payment
// Called by the frontend immediately after stripe.confirmPayment() succeeds.
// Verifies the PaymentIntent with Stripe and marks the extension as PAID.
// This closes the race condition between frontend success and webhook arrival.
// The webhook handler is idempotent — if it fires later, it skips already-PAID.
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> }
) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    const userId = (token?.userId as string) || token?.sub;
    if (!userId) {
      return ApiErrors.unauthorized();
    }

    const { extensionId } = await params;

    const body = await request.json();
    const validation = confirmSchema.safeParse(body);
    if (!validation.success) {
      return ApiErrors.badRequest('Invalid request body');
    }

    const { paymentIntentId } = validation.data;

    // -----------------------------------------------------------------------
    // 1. Look up the extension
    // -----------------------------------------------------------------------
    const extension = await db.bookingExtension.findUnique({
      where: { id: extensionId },
      include: {
        booking: {
          select: {
            id: true,
            parentId: true,
            caregiverId: true,
            totalHours: true,
            subtotal: true,
            platformFee: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!extension) {
      return ApiErrors.notFound('Extension not found');
    }

    // Verify the authenticated user is the parent
    if (extension.booking.parentId !== userId) {
      return ApiErrors.forbidden('Not authorized');
    }

    // Idempotency: already paid
    if (extension.status === 'PAID') {
      return apiSuccess({ alreadyPaid: true });
    }

    // -----------------------------------------------------------------------
    // 2. Verify with Stripe that the PaymentIntent actually succeeded
    // -----------------------------------------------------------------------
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify the PI matches this extension (security check)
    if (pi.metadata.extensionId !== extensionId) {
      return ApiErrors.forbidden('PaymentIntent does not match this extension');
    }

    if (pi.status !== 'succeeded') {
      return ApiErrors.badRequest(
        `Payment has not succeeded yet (status: ${pi.status})`
      );
    }

    // -----------------------------------------------------------------------
    // 3. Mark extension as PAID and update booking totals
    //    (Same logic as the webhook handler — both are idempotent)
    // -----------------------------------------------------------------------
    await db.bookingExtension.update({
      where: { id: extensionId },
      data: {
        status: 'PAID',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
    });

    const extensionHours = extension.extensionMinutes / 60;

    await db.booking.update({
      where: { id: extension.bookingId },
      data: {
        endTime: extension.newEndTime,
        totalHours: extension.booking.totalHours + extensionHours,
        subtotal: extension.booking.subtotal + extension.extensionAmount,
        platformFee: extension.booking.platformFee + extension.platformFee,
        totalAmount: extension.booking.totalAmount + extension.extensionAmount,
      },
    });

    // Create notifications
    await db.notification.create({
      data: {
        userId: extension.booking.parentId,
        type: 'PAYMENT_RECEIVED',
        title: 'Extension Payment Confirmed',
        message: `Your payment of $${(extension.extensionAmount / 100).toFixed(2)} for the ${extension.extensionMinutes}-minute extension has been confirmed.`,
        resourceType: 'booking_extension',
        resourceId: extension.id,
      },
    });

    await db.notification.create({
      data: {
        userId: extension.booking.caregiverId,
        type: 'BOOKING_UPDATE',
        title: 'Extension Approved & Paid',
        message: `The ${extension.extensionMinutes}-minute extension has been approved and paid. The booking has been extended.`,
        resourceType: 'booking_extension',
        resourceId: extension.id,
      },
    });

    console.log(
      `[ConfirmPayment] Extension ${extensionId} marked PAID via frontend confirmation (PI: ${paymentIntentId})`
    );

    return apiSuccess({ confirmed: true });
  } catch (error: unknown) {
    console.error(
      '[ConfirmPayment] Error:',
      error instanceof Error ? error.message : String(error)
    );
    return ApiErrors.internal('Failed to confirm payment');
  }
}
