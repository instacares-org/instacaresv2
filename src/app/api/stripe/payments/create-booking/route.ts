import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { metrics } from "@/lib/metrics";
import { getStripeInstance, calculateCommissionAsync } from '@/lib/stripe';
import { processPaymentAmount, isDemoMode, isTestMode, getCurrentConfig } from '@/lib/payment-modes';
import { db } from '@/lib/db';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

const createBookingPaymentSchema = z.object({
  caregiverStripeAccountId: z.string()
    .min(1, 'Caregiver Stripe account ID is required')
    .max(100, 'Invalid Stripe account ID'),

  amount: z.number()
    .int('Amount must be a whole number')
    .min(100, 'Amount must be at least $1.00')
    .max(100000000, 'Amount exceeds maximum limit'),

  parentEmail: z.string()
    .email('Invalid email address')
    .max(254, 'Email too long')
    .toLowerCase()
    .trim(),

  parentId: z.string().min(1).max(50).optional(),

  parentName: z.string().max(200).trim().optional(),

  caregiverName: z.string()
    .min(1, 'Caregiver name is required')
    .max(200, 'Caregiver name too long')
    .trim(),

  caregiverId: z.string()
    .min(1, 'Caregiver ID is required')
    .max(50, 'Invalid caregiver ID'),

  bookingDetails: z.object({
    date: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isMultiDay: z.boolean().optional(),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    childrenCount: z.number().int().min(1).max(10).default(1),
    selectedChildIds: z.array(z.string()).optional(),
    specialRequests: z.string().max(1000).trim().optional(),
    address: z.string().max(500).trim().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

// Server-side amount calculation matching frontend logic
function calculateServerAmount(
  hourlyRate: number,
  startTime: string,
  endTime: string,
  childrenCount: number,
  days: number
): number {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

  if (hours <= 0) return 0;

  const basePrice = hours * days * hourlyRate;

  // Multi-child multiplier: +10% per additional child
  const multiChildMultiplier = childrenCount > 1 ? 1 + ((childrenCount - 1) * 0.1) : 1;

  // Multi-day discount
  let multiDayDiscount = 1;
  if (days >= 5) {
    multiDayDiscount = 0.9;
  } else if (days >= 3) {
    multiDayDiscount = 0.95;
  }

  return Math.round(basePrice * multiChildMultiplier * multiDayDiscount * 100); // cents
}

// Helper function to get or create a Stripe customer for the parent
async function getOrCreateStripeCustomer(
  stripe: any,
  parentId: string | undefined,
  parentEmail: string,
  parentName: string | undefined
): Promise<string> {
  // If we have a parentId, try to find existing customer in our database
  if (parentId) {
    const user = await db.user.findUnique({
      where: { id: parentId },
      select: { stripeCustomerId: true, profile: { select: { firstName: true, lastName: true } } }
    });

    if (user?.stripeCustomerId) {
      // Verify the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(user.stripeCustomerId);
        return user.stripeCustomerId;
      } catch (e) {
        // Customer doesn't exist in Stripe anymore, create a new one
        console.log(`[Payment] Stripe customer ${user.stripeCustomerId} not found, creating new one`);
      }
    }

    // Get name from profile if not provided
    if (!parentName && user?.profile) {
      parentName = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || undefined;
    }
  }

  // Search for existing customer by email in Stripe
  const existingCustomers = await stripe.customers.list({
    email: parentEmail,
    limit: 1
  });

  if (existingCustomers.data.length > 0) {
    const customerId = existingCustomers.data[0].id;

    // Save the customer ID to our database if we have a parentId
    if (parentId) {
      await db.user.update({
        where: { id: parentId },
        data: { stripeCustomerId: customerId }
      });
    }

    return customerId;
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email: parentEmail,
    name: parentName || undefined,
    metadata: {
      userId: parentId || '',
      source: 'booking_payment'
    }
  });

  // Save the customer ID to our database if we have a parentId
  if (parentId) {
    await db.user.update({
      where: { id: parentId },
      data: { stripeCustomerId: customer.id }
    });
  }

  console.log(`[Payment] Created new Stripe customer ${customer.id} for ${parentEmail}`);
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    // --- RATE LIMITING ---
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.PAYMENT);
    if (!rateLimitResult.success) {
      return ApiErrors.tooManyRequests('Too many requests. Please try again later.');
    }

    // --- AUTHENTICATION ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    // Validate input using Zod schema
    const parsed = createBookingPaymentSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[Payment] Zod validation failed:', JSON.stringify(parsed.error.flatten().fieldErrors));
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const {
      caregiverStripeAccountId,
      amount,
      parentEmail,
      parentId,
      parentName,
      caregiverName,
      caregiverId,
      bookingDetails,
    } = parsed.data;

    // --- AUTHORIZATION: Verify the authenticated user is the parent ---
    if (parentId && parentId !== session.user.id) {
      console.error(`[Payment] Auth mismatch: session user ${session.user.id} tried to pay as ${parentId}`);
      return ApiErrors.forbidden('You can only create payments for yourself');
    }
    if (parentEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      console.error(`[Payment] Email mismatch: session ${session.user.email} vs request ${parentEmail}`);
      return ApiErrors.forbidden('Email does not match your account');
    }

    // Calculate childrenCount from selectedChildIds if not provided
    if (bookingDetails && !bookingDetails.childrenCount && bookingDetails.selectedChildIds) {
      bookingDetails.childrenCount = bookingDetails.selectedChildIds.length || 1;
    }

    // --- SERVER-SIDE AMOUNT VALIDATION ---
    // Look up the caregiver to get their verified hourly rate and Stripe account
    // caregiverId from frontend is the User ID (Booking.caregiverId = User.id)
    const caregiver = await db.caregiver.findUnique({
      where: { userId: caregiverId },
      select: { hourlyRate: true, stripeAccountId: true, userId: true, canReceivePayments: true }
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver not found');
    }

    // Verify caregiver can receive payments (skip for demo accounts still testing)
    const isDemoAccount = caregiverStripeAccountId.startsWith('acct_demo_') || caregiverStripeAccountId === 'acct_test_demo';
    if (!isDemoAccount && !caregiver.canReceivePayments) {
      console.error(`[Payment] Caregiver ${caregiverId} cannot receive payments (canReceivePayments=false)`);
      return ApiErrors.badRequest('This caregiver has not completed payment setup. Please try again later.');
    }

    // Verify the Stripe account ID matches the caregiver's actual account
    // (skip for demo accounts which may not match)
    if (!isDemoAccount &&
        caregiver.stripeAccountId &&
        caregiver.stripeAccountId !== caregiverStripeAccountId) {
      console.error(`[Payment] Stripe account mismatch for caregiver ${caregiverId}: expected ${caregiver.stripeAccountId}, got ${caregiverStripeAccountId}`);
      return ApiErrors.badRequest('Invalid caregiver payment account');
    }

    // Calculate days for multi-day bookings
    let days = 1;
    if (bookingDetails.isMultiDay && bookingDetails.startDate && bookingDetails.endDate) {
      const startDate = new Date(bookingDetails.startDate);
      const endDate = new Date(bookingDetails.endDate);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Server-side amount calculation using verified caregiver hourly rate
    const serverCalculatedAmount = calculateServerAmount(
      caregiver.hourlyRate,
      bookingDetails.startTime,
      bookingDetails.endTime,
      bookingDetails.childrenCount || 1,
      days
    );

    // Allow 5% tolerance for rounding differences, minimum $5 tolerance
    const tolerance = Math.max(500, Math.round(serverCalculatedAmount * 0.05));
    if (Math.abs(amount - serverCalculatedAmount) > tolerance) {
      console.error(`[Payment] Amount mismatch: client sent ${amount}, server calculated ${serverCalculatedAmount} (tolerance ${tolerance})`);
      return ApiErrors.badRequest('Payment amount does not match the booking details. Please refresh and try again.');
    }

    // Use the server-calculated amount (not client-provided)
    const verifiedAmount = serverCalculatedAmount;

    // Process amount based on payment mode
    const processedAmount = processPaymentAmount(verifiedAmount);
    const commissionAmount = await calculateCommissionAsync(processedAmount);
    const paymentConfig = getCurrentConfig();

    // Payment creation initiated

    // Handle demo mode with simulated payment
    if (isDemoMode()) {
      // Demo mode activated

      // Generate a fake payment intent ID for demo
      const fakePaymentIntentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fakeClientSecret = `${fakePaymentIntentId}_secret_demo`;

      return apiSuccess({
        clientSecret: fakeClientSecret,
        paymentIntentId: fakePaymentIntentId,
        amount: processedAmount,
        originalAmount: verifiedAmount,
        commission: commissionAmount,
        caregiverPayout: processedAmount - commissionAmount,
        mode: paymentConfig.name,
        demo: true,
      });
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    // Demo account: create a regular payment intent (without Connect transfer)
    if (caregiverStripeAccountId.startsWith('acct_demo_') || caregiverStripeAccountId === 'acct_test_demo') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: processedAmount,
        currency: 'cad',
        metadata: {
          bookingDate: (bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date) ?? '',
          endDate: (bookingDetails.isMultiDay ? bookingDetails.endDate : bookingDetails.date) ?? '',
          isMultiDay: bookingDetails.isMultiDay ? 'true' : 'false',
          startTime: bookingDetails.startTime,
          endTime: bookingDetails.endTime,
          childrenCount: bookingDetails.childrenCount.toString(),
          selectedChildIds: (bookingDetails.selectedChildIds || []).join(','),
          caregiverName,
          caregiverId: caregiverId,
          parentEmail: session.user.email,
          parentId: session.user.id,
          specialRequests: bookingDetails.specialRequests || '',
          address: bookingDetails.address || '',
          latitude: bookingDetails.latitude?.toString() || '',
          longitude: bookingDetails.longitude?.toString() || '',
          demoMode: 'true',
        },
        receipt_email: session.user.email,
        description: `Childcare booking with ${caregiverName} on ${bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date} (Demo)`,
      });

      return apiSuccess({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: processedAmount,
        originalAmount: verifiedAmount,
        commission: commissionAmount,
        caregiverPayout: processedAmount - commissionAmount,
        mode: paymentConfig.name,
        demo: true,
      });
    }

    // Get or create Stripe customer for the parent (using verified session user ID)
    // This ensures the payment method can be reused for extensions
    const customerId = await getOrCreateStripeCustomer(stripe, session.user.id, session.user.email, parentName);

    // Real Stripe Connect payment with customer attached
    const paymentIntent = await stripe.paymentIntents.create({
      amount: processedAmount,
      currency: 'cad', // Using CAD for Canadian platform
      customer: customerId, // Attach to customer for future reuse
      setup_future_usage: 'off_session', // Save payment method for extensions
      application_fee_amount: commissionAmount,
      transfer_data: {
        destination: caregiverStripeAccountId,
      },
      metadata: {
        bookingDate: (bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date) ?? '',
        endDate: (bookingDetails.isMultiDay ? bookingDetails.endDate : bookingDetails.date) ?? '',
        isMultiDay: bookingDetails.isMultiDay ? 'true' : 'false',
        startTime: bookingDetails.startTime,
        endTime: bookingDetails.endTime,
        childrenCount: bookingDetails.childrenCount.toString(),
        selectedChildIds: (bookingDetails.selectedChildIds || []).join(','),
        caregiverName,
        caregiverId: caregiverId,
        parentEmail: session.user.email,
        parentId: session.user.id,
        specialRequests: bookingDetails.specialRequests || '',
        address: bookingDetails.address || '',
        latitude: bookingDetails.latitude?.toString() || '',
        longitude: bookingDetails.longitude?.toString() || '',
      },
      receipt_email: session.user.email,
      description: `Childcare booking with ${caregiverName} on ${bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date}`,
    });

    console.log(`[Payment] Created payment intent ${paymentIntent.id} for customer ${customerId}`);

    return apiSuccess({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customerId, // Return customer ID for frontend
      amount: processedAmount,
      originalAmount: verifiedAmount,
      commission: commissionAmount,
      caregiverPayout: processedAmount - commissionAmount,
      mode: paymentConfig.name,
    });
  } catch (error: any) {
    // Payment error logged securely

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return ApiErrors.badRequest('Invalid payment request. Please check your information.');
    }

    return ApiErrors.internal('Failed to create booking payment');
  }
}
