import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { metrics } from "@/lib/metrics";
import { getStripeInstance, calculateCommissionAsync } from '@/lib/stripe';
import { processPaymentAmount, isDemoMode, isTestMode, getCurrentConfig } from '@/lib/payment-modes';
import { db } from '@/lib/db';

interface BookingRequest {
  caregiverStripeAccountId: string;
  amount: number; // Amount in cents (client-side calculation, validated server-side)
  parentEmail: string;
  parentId?: string; // User ID of the parent
  parentName?: string; // Full name of the parent
  caregiverName: string;
  caregiverId: string;
  bookingDetails: {
    date?: string;
    startDate?: string;
    endDate?: string;
    isMultiDay?: boolean;
    startTime: string;
    endTime: string;
    childrenCount: number;
    selectedChildIds?: string[];
    specialRequests?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

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
    // --- AUTHENTICATION ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    }: BookingRequest = await request.json();

    // --- AUTHORIZATION: Verify the authenticated user is the parent ---
    if (parentId && parentId !== session.user.id) {
      console.error(`[Payment] Auth mismatch: session user ${session.user.id} tried to pay as ${parentId}`);
      return NextResponse.json(
        { error: 'You can only create payments for yourself' },
        { status: 403 }
      );
    }
    if (parentEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      console.error(`[Payment] Email mismatch: session ${session.user.email} vs request ${parentEmail}`);
      return NextResponse.json(
        { error: 'Email does not match your account' },
        { status: 403 }
      );
    }

    // Calculate childrenCount from selectedChildIds if not provided
    if (bookingDetails && !bookingDetails.childrenCount && bookingDetails.selectedChildIds) {
      bookingDetails.childrenCount = bookingDetails.selectedChildIds.length || 1;
    }

    // Validate required fields
    if (!caregiverStripeAccountId || !caregiverId || amount === null || amount === undefined || !parentEmail) {
      return NextResponse.json(
        { error: 'Missing required booking information' },
        { status: 400 }
      );
    }

    if (!bookingDetails?.startTime || !bookingDetails?.endTime) {
      return NextResponse.json(
        { error: 'Booking start and end times are required' },
        { status: 400 }
      );
    }

    // --- SERVER-SIDE AMOUNT VALIDATION ---
    // Look up the caregiver to get their verified hourly rate and Stripe account
    const caregiver = await db.caregiver.findUnique({
      where: { id: caregiverId },
      select: { hourlyRate: true, stripeAccountId: true, userId: true, canReceivePayments: true }
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver not found' },
        { status: 404 }
      );
    }

    // Verify caregiver can receive payments (skip for demo accounts still testing)
    const isDemoAccount = caregiverStripeAccountId.startsWith('acct_demo_') || caregiverStripeAccountId === 'acct_test_demo';
    if (!isDemoAccount && !caregiver.canReceivePayments) {
      console.error(`[Payment] Caregiver ${caregiverId} cannot receive payments (canReceivePayments=false)`);
      return NextResponse.json(
        { error: 'This caregiver has not completed payment setup. Please try again later.' },
        { status: 400 }
      );
    }

    // Verify the Stripe account ID matches the caregiver's actual account
    // (skip for demo accounts which may not match)
    if (!isDemoAccount &&
        caregiver.stripeAccountId &&
        caregiver.stripeAccountId !== caregiverStripeAccountId) {
      console.error(`[Payment] Stripe account mismatch for caregiver ${caregiverId}: expected ${caregiver.stripeAccountId}, got ${caregiverStripeAccountId}`);
      return NextResponse.json(
        { error: 'Invalid caregiver payment account' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Payment amount does not match the booking details. Please refresh and try again.' },
        { status: 400 }
      );
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

      return NextResponse.json({
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
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
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

      return NextResponse.json({
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

    return NextResponse.json({
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
      return NextResponse.json(
        { error: 'Invalid payment request. Please check your information.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create booking payment' },
      { status: 500 }
    );
  }
}
