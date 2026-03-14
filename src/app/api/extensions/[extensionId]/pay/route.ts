import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/extensions/[extensionId]/pay
// Returns extension details so the payment UI can display amount, minutes, etc.
// =============================================================================
export async function GET(
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

    const extension = await db.bookingExtension.findUnique({
      where: { id: extensionId },
      include: {
        booking: {
          include: {
            parent: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
            caregiverUser: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!extension) {
      return ApiErrors.notFound('Extension not found');
    }

    // Only the parent of the booking can view extension payment details
    if (extension.booking.parentId !== userId) {
      return ApiErrors.forbidden('You are not authorized to view this extension');
    }

    return apiSuccess({
      id: extension.id,
      extensionMinutes: extension.extensionMinutes,
      extensionAmount: extension.extensionAmount,
      hourlyRate: extension.hourlyRate,
      originalEndTime: extension.originalEndTime,
      newEndTime: extension.newEndTime,
      status: extension.status,
      reason: extension.reason,
      createdAt: extension.createdAt,
      booking: {
        id: extension.booking.id,
        startTime: extension.booking.startTime,
        endTime: extension.booking.endTime,
        address: extension.booking.address,
        status: extension.booking.status,
        caregiver: {
          id: extension.booking.caregiverUser.id,
          firstName: extension.booking.caregiverUser.profile?.firstName ?? null,
          lastName: extension.booking.caregiverUser.profile?.lastName ?? null,
        },
      },
    });
  } catch (error) {
    console.error('[ExtensionPay] Error fetching extension details:', error);
    return ApiErrors.internal('Failed to fetch extension details');
  }
}

// =============================================================================
// POST /api/extensions/[extensionId]/pay
// Creates a Stripe PaymentIntent for a PAYMENT_PENDING booking extension.
// The parent completes payment on-session using Stripe Elements.
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

    // -----------------------------------------------------------------------
    // 1. Look up the extension with booking + parent data
    // -----------------------------------------------------------------------
    const extension = await db.bookingExtension.findUnique({
      where: { id: extensionId },
      include: {
        booking: {
          include: {
            parent: {
              select: {
                id: true,
                email: true,
                stripeCustomerId: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
            caregiverUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!extension) {
      return ApiErrors.notFound('Extension not found');
    }

    // -----------------------------------------------------------------------
    // 2. Verify the authenticated user is the parent of this booking
    // -----------------------------------------------------------------------
    if (extension.booking.parentId !== userId) {
      return ApiErrors.forbidden('You are not authorized to pay for this extension');
    }

    // -----------------------------------------------------------------------
    // 3. Verify the extension is in a payable status
    // -----------------------------------------------------------------------
    if (extension.status === 'PAID') {
      return apiError('Extension has already been paid', 400);
    }

    if (extension.status !== 'PAYMENT_PENDING' && extension.status !== 'FAILED') {
      return apiError(
        `Extension is in ${extension.status} status and cannot be paid`,
        400
      );
    }

    // -----------------------------------------------------------------------
    // 4. Initialize Stripe
    // -----------------------------------------------------------------------
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    // -----------------------------------------------------------------------
    // 4b. Idempotency: if extension already has a PaymentIntent, reuse it
    // -----------------------------------------------------------------------
    if (extension.stripePaymentIntentId) {
      try {
        const existingPI = await stripe.paymentIntents.retrieve(
          extension.stripePaymentIntentId
        );

        if (existingPI.status === 'succeeded') {
          // Payment already succeeded (webhook may not have fired yet)
          return apiSuccess({
            alreadyPaid: true,
            message: 'Payment has already been processed',
          });
        }

        if (
          existingPI.status === 'requires_payment_method' ||
          existingPI.status === 'requires_confirmation' ||
          existingPI.status === 'requires_action'
        ) {
          // Reuse the existing PaymentIntent
          console.log(
            `[ExtensionPay] Reusing existing PaymentIntent ${existingPI.id} for extension ${extension.id}`
          );
          return apiSuccess({
            clientSecret: existingPI.client_secret,
            paymentIntentId: existingPI.id,
            amount: extension.extensionAmount,
            extensionMinutes: extension.extensionMinutes,
          });
        }

        // PI is in a terminal failed/cancelled state — create a new one below
        console.log(
          `[ExtensionPay] Existing PI ${existingPI.id} is ${existingPI.status}, creating new one`
        );
      } catch (err) {
        console.warn(
          `[ExtensionPay] Could not retrieve existing PI ${extension.stripePaymentIntentId}:`,
          err
        );
        // Fall through and create a new PI
      }
    }

    // -----------------------------------------------------------------------
    // 5. Get or create a Stripe customer for the parent
    // -----------------------------------------------------------------------
    const parent = extension.booking.parent;
    let customerId = parent.stripeCustomerId;

    if (!customerId) {
      // No saved Stripe customer -- create one
      const parentName = [
        parent.profile?.firstName,
        parent.profile?.lastName,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

      const customer = await stripe.customers.create({
        email: parent.email,
        name: parentName,
        metadata: {
          userId: parent.id,
          source: 'extension_payment',
        },
      });

      customerId = customer.id;

      // Persist the new Stripe customer ID to the database
      await db.user.update({
        where: { id: parent.id },
        data: { stripeCustomerId: customerId },
      });

      console.log(
        `[ExtensionPay] Created Stripe customer ${customerId} for parent ${parent.id}`
      );
    }

    // -----------------------------------------------------------------------
    // 6. Create a PaymentIntent (on-session, parent completes via Elements)
    // -----------------------------------------------------------------------
    const paymentIntent = await stripe.paymentIntents.create({
      amount: extension.extensionAmount,
      currency: 'cad',
      customer: customerId,
      setup_future_usage: 'off_session',
      metadata: {
        type: 'booking_extension',
        extensionId: extension.id,
        bookingId: extension.bookingId,
        parentId: extension.booking.parentId,
        caregiverId: extension.booking.caregiverId,
        extensionMinutes: extension.extensionMinutes.toString(),
      },
      description: `Booking extension: ${extension.extensionMinutes} minutes`,
    });

    console.log(
      `[ExtensionPay] Created PaymentIntent ${paymentIntent.id} for extension ${extension.id} (amount: ${extension.extensionAmount})`
    );

    // -----------------------------------------------------------------------
    // 7. Save PaymentIntent ID on the extension for idempotency & tracking
    // -----------------------------------------------------------------------
    await db.bookingExtension.update({
      where: { id: extension.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    // -----------------------------------------------------------------------
    // 8. Return clientSecret so the frontend can complete payment
    // -----------------------------------------------------------------------
    return apiSuccess({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: extension.extensionAmount,
      extensionMinutes: extension.extensionMinutes,
    });
  } catch (error: any) {
    console.error('[ExtensionPay] Error creating payment intent:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return ApiErrors.badRequest(
        'Invalid payment request. Please check your information and try again.'
      );
    }

    return ApiErrors.internal('Failed to create extension payment');
  }
}
