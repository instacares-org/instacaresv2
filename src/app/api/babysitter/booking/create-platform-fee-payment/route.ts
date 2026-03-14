import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { getStripeInstance, getCommissionRate } from '@/lib/stripe';
import { z } from 'zod';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

const paymentSchema = z.object({
  babysitterId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  childrenCount: z.number().min(1).max(6),
  specialRequests: z.string().max(500).optional(),
  address: z.string().min(5),
  apartment: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().min(3),
});

// Helper: get or create Stripe customer for parent
async function getOrCreateStripeCustomer(
  stripe: any,
  parentId: string,
  parentEmail: string,
  parentName?: string
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: parentId },
    select: { stripeCustomerId: true, profile: { select: { firstName: true, lastName: true } } }
  });

  if (user?.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
      return user.stripeCustomerId;
    } catch {
      // Customer doesn't exist in Stripe, create new one
    }
  }

  const name = parentName || (user?.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : undefined);

  // Search by email first
  const existing = await stripe.customers.list({ email: parentEmail, limit: 1 });
  if (existing.data.length > 0) {
    const customerId = existing.data[0].id;
    await db.user.update({ where: { id: parentId }, data: { stripeCustomerId: customerId } });
    return customerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: parentEmail,
    name: name || undefined,
    metadata: { userId: parentId, source: 'babysitter_platform_fee' },
  });

  await db.user.update({ where: { id: parentId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    // --- RATE LIMITING ---
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.PAYMENT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return ApiErrors.unauthorized();
    }

    const parentId = session.user.id;
    const body = await request.json();
    const validatedData = paymentSchema.parse(body);

    // Verify babysitter exists and is available
    const babysitter = await db.babysitter.findUnique({
      where: { id: validatedData.babysitterId },
      include: { user: true },
    });

    if (!babysitter || babysitter.status !== 'APPROVED' || !babysitter.isAvailable) {
      return ApiErrors.badRequest('Babysitter is not available');
    }

    if (!babysitter.acceptsOnsitePayment) {
      return ApiErrors.badRequest('This babysitter does not accept on-site payments');
    }

    // Calculate pricing
    const startTime = new Date(validatedData.startTime);
    const endTime = new Date(validatedData.endTime);
    const totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    if (totalHours < 2) {
      return ApiErrors.badRequest('Minimum booking is 2 hours');
    }

    const commissionRate = await getCommissionRate();
    const subtotal = Math.round(babysitter.hourlyRate * totalHours * 100); // cents
    const platformFee = Math.round(subtotal * commissionRate);

    // Stripe minimum charge is 50 cents
    if (platformFee < 50) {
      return ApiErrors.badRequest('Booking amount is too small for payment processing. Minimum platform fee is $0.50.');
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return apiError('Payment system unavailable', 503);
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(stripe, parentId, session.user.email);

    // Create PaymentIntent for ONLY the platform fee (direct charge to platform, no Connect)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: platformFee,
      currency: 'cad',
      customer: customerId,
      metadata: {
        type: 'babysitter_platform_fee',
        babysitterId: validatedData.babysitterId,
        parentId,
        subtotal: subtotal.toString(),
        platformFee: platformFee.toString(),
        totalAmount: (subtotal + platformFee).toString(),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        childrenCount: validatedData.childrenCount.toString(),
        address: validatedData.address,
        city: validatedData.city,
      },
      receipt_email: session.user.email,
      description: `Platform fee for babysitter booking`,
    });

    return apiSuccess({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFee,
      subtotal,
      totalAmount: subtotal + platformFee,
      commissionRate: Math.round(commissionRate * 100),
    });
  } catch (error: any) {
    console.error('Create platform fee payment error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    if (error.type === 'StripeInvalidRequestError') {
      return ApiErrors.badRequest('Payment processing error');
    }

    return ApiErrors.internal('Failed to create payment');
  }
}
