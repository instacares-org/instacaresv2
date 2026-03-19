import { NextRequest, NextResponse } from 'next/server';
import { apiError, ApiErrors } from '@/lib/api-utils';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { getStripeConfig } from '@/lib/payment-modes';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    const webhookSecret = getStripeConfig().webhookSecret;
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
      return ApiErrors.internal('Webhook secret not configured');
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: unknown) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : String(err));
    return ApiErrors.badRequest('Invalid signature');
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Here you would typically:
        // 1. Update booking status in your database
        // 2. Send confirmation emails
        // 3. Notify both parent and caregiver
        // 4. Update caregiver earnings
        
        await handleSuccessfulPayment(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        
        // Handle failed payment
        await handleFailedPayment(failedPayment);
        break;

      case 'account.updated':
        const account = event.data.object;
        console.log('Account updated:', account.id);
        
        // Update caregiver account status in database
        await handleAccountUpdate(account);
        break;

      case 'payout.paid':
        const payout = event.data.object;
        console.log('Payout completed:', payout.id);
        
        // Record successful payout
        await handlePayoutPaid(payout);
        break;

      case 'payout.failed':
        const failedPayout = event.data.object;
        console.log('Payout failed:', failedPayout.id);
        
        // Handle failed payout
        await handlePayoutFailed(failedPayout);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return ApiErrors.internal('Webhook processing failed');
  }
}

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing successful payment:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    applicationFeeAmount: paymentIntent.application_fee_amount,
    type: paymentIntent.metadata?.type || 'booking',
  });

  // Route extension payments to the dedicated handler
  if (paymentIntent.metadata?.type === 'booking_extension') {
    await handleExtensionPayment(paymentIntent);
    return;
  }

  try {
    // --- Idempotency check: skip if this PaymentIntent was already processed ---
    const { default: db } = await import('@/lib/db');
    const existingPayment = await db.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (existingPayment) {
      console.log('Duplicate webhook detected (payment already exists), skipping:', paymentIntent.id);
      return;
    }

    const metadata = paymentIntent.metadata;

    // Extract booking details from metadata
    const caregiverId = metadata.caregiverId;
    const parentEmail = metadata.parentEmail;
    const bookingDate = metadata.bookingDate; // Start date
    const endDate = metadata.endDate; // End date (same as start for single day)
    const isMultiDay = metadata.isMultiDay === 'true';
    const startTime = metadata.startTime;
    const endTime = metadata.endTime;
    const childrenCount = parseInt(metadata.childrenCount);
    const specialRequests = metadata.specialRequests || '';
    const address = metadata.address || '';
    const latitude = metadata.latitude ? parseFloat(metadata.latitude) : undefined;
    const longitude = metadata.longitude ? parseFloat(metadata.longitude) : undefined;

    if (!caregiverId || !parentEmail || !bookingDate) {
      // Throw so the outer handler returns 500 → Stripe retries the webhook
      throw new Error(`Missing required booking metadata for payment ${paymentIntent.id}`);
    }

    // Find parent user by email
    const { userOperations, bookingOperations, paymentOperations } = await import('@/lib/db');
    const parent = await userOperations.findUserByEmail(parentEmail);

    if (!parent) {
      // Throw so Stripe retries — parent account may not be synced yet
      throw new Error(`Parent not found for payment ${paymentIntent.id}`);
    }

    // Handle multi-day vs single-day bookings with proper timezone handling
    // Always create dates in local timezone to avoid timezone shifts
    let startDateTime, endDateTime;

    if (isMultiDay && endDate && endDate !== bookingDate) {
      // Multi-day booking: create booking spanning multiple days
      // Parse dates manually to avoid timezone issues
      const [startYear, startMonth, startDay] = bookingDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      startDateTime = new Date(startYear, startMonth - 1, startDay, startHour, startMinute);
      endDateTime = new Date(endYear, endMonth - 1, endDay, endHour, endMinute);

      console.log('Creating multi-day booking:', {
        from: startDateTime.toISOString(),
        to: endDateTime.toISOString(),
        days: Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) + 1
      });
    } else {
      // Single-day booking
      // Parse date manually to avoid timezone issues
      const [year, month, day] = bookingDate.split('-').map(Number);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      startDateTime = new Date(year, month - 1, day, startHour, startMinute);
      endDateTime = new Date(year, month - 1, day, endHour, endMinute);

      console.log('Creating single-day booking:', {
        date: bookingDate,
        from: startDateTime.toISOString(),
        to: endDateTime.toISOString(),
        localDate: startDateTime.toLocaleDateString(),
        localTime: `${startDateTime.toLocaleTimeString()} - ${endDateTime.toLocaleTimeString()}`
      });
    }

    // Calculate totals — always use Stripe's authoritative application_fee_amount, never metadata
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const platformCommission = paymentIntent.application_fee_amount || 0;
    const caregiverPayout = paymentIntent.amount - platformCommission;

    if (!paymentIntent.application_fee_amount) {
      console.warn(`[Webhook] Payment ${paymentIntent.id} has no application_fee_amount — commission set to 0`);
    }

    // Get caregiver hourly rate (estimate from total amount and hours)
    const hourlyRate = Math.round((paymentIntent.amount / 100) / totalHours);

    console.log('Creating booking with details:', {
      parentId: parent.id,
      caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      childrenCount,
      totalHours,
      hourlyRate,
      totalAmount: paymentIntent.amount,
      platformFee: platformCommission
    });

    // Create booking record
    const booking = await bookingOperations.createBooking({
      parentId: parent.id,
      caregiverId: caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
      hourlyRate,
      totalHours,
      subtotal: paymentIntent.amount,
      platformFee: platformCommission,
      totalAmount: paymentIntent.amount,
    });

    console.log('✅ Booking created successfully:', booking.id);

    // Create payment record — stripePaymentIntentId has a @unique constraint in the DB,
    // so if a duplicate webhook fires concurrently, the second insert will fail with P2002
    // (unique constraint violation) and be caught below, preventing double-processing.
    const payment = await paymentOperations.createPayment({
      bookingId: booking.id,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      platformFee: platformCommission,
      caregiverPayout: caregiverPayout,
      status: 'PAID'
    });

    console.log('✅ Payment record created:', payment.id);

    // Update booking status to confirmed
    await bookingOperations.updateBookingStatus(booking.id, 'CONFIRMED');

    console.log('✅ Booking confirmed and ready for dashboards');

  } catch (error: unknown) {
    // Prisma unique constraint violation on stripePaymentIntentId = duplicate webhook
    if (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'P2002') {
      console.log('Duplicate webhook detected (unique constraint), skipping:', paymentIntent.id);
      return;
    }
    console.error('❌ Error creating booking from payment:', error instanceof Error ? error.message : String(error));
    throw error; // Re-throw so the outer handler returns 500 and Stripe retries
  }
}

async function handleExtensionPayment(paymentIntent: Stripe.PaymentIntent) {
  const extensionId = paymentIntent.metadata.extensionId;

  console.log('[Webhook] Processing extension payment:', {
    paymentIntentId: paymentIntent.id,
    extensionId,
    amount: paymentIntent.amount,
  });

  if (!extensionId) {
    throw new Error(`[Webhook] Extension payment missing extensionId in metadata: ${paymentIntent.id}`);
  }

  try {
    const { default: db } = await import('@/lib/db');

    // Fetch the extension with its booking data for totals update
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
      throw new Error(`[Webhook] BookingExtension not found for extensionId: ${extensionId}`);
    }

    // Idempotency: if the extension is already PAID, skip duplicate processing
    if (extension.status === 'PAID') {
      console.log('[Webhook] Extension already PAID, skipping duplicate webhook:', extensionId);
      return;
    }

    // Update the extension record to PAID
    await db.bookingExtension.update({
      where: { id: extensionId },
      data: {
        status: 'PAID',
        stripePaymentIntentId: paymentIntent.id,
        paidAt: new Date(),
      },
    });

    console.log('[Webhook] Extension marked as PAID:', extensionId);

    // Update the booking totals to reflect the extension
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

    console.log('[Webhook] Booking totals updated for extension:', extension.bookingId);

    // Notify the parent that the extension payment was confirmed
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

    // Notify the caregiver that the extension has been approved and paid
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

    console.log('[Webhook] Extension payment fully processed:', extensionId);
  } catch (error: unknown) {
    console.error(
      '[Webhook] Error processing extension payment:',
      error instanceof Error ? error.message : String(error)
    );
    throw error; // Re-throw so the outer handler returns 500 and Stripe retries
  }
}

async function handleFailedPayment(failedPayment: Stripe.PaymentIntent) {
  console.log('Processing failed payment:', {
    paymentIntentId: failedPayment.id,
    lastPaymentError: failedPayment.last_payment_error?.code,
  });

  // Handle extension payment failures
  if (failedPayment.metadata?.type === 'booking_extension') {
    await handleExtensionPaymentFailed(failedPayment);
    return;
  }

  try {
    const { default: db } = await import('@/lib/db');
    const parentEmail = failedPayment.metadata?.parentEmail;

    if (!parentEmail) {
      console.warn('[Webhook] Failed payment missing parentEmail in metadata:', failedPayment.id);
      return;
    }

    const parent = await db.user.findUnique({
      where: { email: parentEmail },
      select: { id: true },
    });

    if (!parent) {
      console.warn('[Webhook] Parent not found for failed payment:', parentEmail);
      return;
    }

    const errorMessage = failedPayment.last_payment_error?.message || 'Your payment could not be processed';
    const amount = (failedPayment.amount / 100).toFixed(2);

    await db.notification.create({
      data: {
        userId: parent.id,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Your payment of $${amount} CAD failed: ${errorMessage}. Please update your payment method and try again.`,
        resourceType: 'payment',
        resourceId: failedPayment.id,
      },
    });

    console.log('[Webhook] Parent notified of failed payment:', failedPayment.id);
  } catch (error: unknown) {
    console.error('[Webhook] Error handling failed payment:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handleExtensionPaymentFailed(failedPayment: Stripe.PaymentIntent) {
  const extensionId = failedPayment.metadata.extensionId;

  console.log('[Webhook] Processing failed extension payment:', {
    paymentIntentId: failedPayment.id,
    extensionId,
    errorCode: failedPayment.last_payment_error?.code,
  });

  if (!extensionId) {
    throw new Error(`[Webhook] Failed extension payment missing extensionId in metadata: ${failedPayment.id}`);
  }

  try {
    const { default: db } = await import('@/lib/db');

    const extension = await db.bookingExtension.findUnique({
      where: { id: extensionId },
      include: {
        booking: {
          select: {
            parentId: true,
          },
        },
      },
    });

    if (!extension) {
      throw new Error(`[Webhook] BookingExtension not found for failed payment, extensionId: ${extensionId}`);
    }

    // If already in a terminal state, skip
    if (extension.status === 'PAID' || extension.status === 'FAILED') {
      console.log('[Webhook] Extension already in terminal state, skipping:', extensionId, extension.status);
      return;
    }

    // Mark the extension as FAILED
    await db.bookingExtension.update({
      where: { id: extensionId },
      data: {
        status: 'FAILED',
        stripePaymentIntentId: failedPayment.id,
      },
    });

    console.log('[Webhook] Extension marked as FAILED:', extensionId);

    // Notify the parent about the failed payment
    const errorMessage = failedPayment.last_payment_error?.message || 'Your payment could not be processed';
    await db.notification.create({
      data: {
        userId: extension.booking.parentId,
        type: 'PAYMENT_FAILED',
        title: 'Extension Payment Failed',
        message: `The payment of $${(extension.extensionAmount / 100).toFixed(2)} for the ${extension.extensionMinutes}-minute extension failed. ${errorMessage}. Please update your payment method and try again.`,
        resourceType: 'booking_extension',
        resourceId: extension.id,
      },
    });

    console.log('[Webhook] Parent notified of failed extension payment:', extensionId);
  } catch (error: unknown) {
    console.error(
      '[Webhook] Error handling failed extension payment:',
      error instanceof Error ? error.message : String(error)
    );
    throw error; // Re-throw so Stripe retries
  }
}

async function handleAccountUpdate(account: Stripe.Account) {
  console.log('[Webhook] Processing account update:', {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    payoutsEnabled: account.payouts_enabled,
  });

  try {
    const { default: db } = await import('@/lib/db');

    // Look up caregiver by stripeAccountId
    const caregiver = await db.caregiver.findFirst({
      where: { stripeAccountId: account.id },
      select: { id: true, userId: true, stripeOnboarded: true, canReceivePayments: true },
    });

    // Also check babysitter by stripeConnectId
    const babysitter = !caregiver ? await db.babysitter.findFirst({
      where: { stripeConnectId: account.id },
      select: { id: true, userId: true, stripeOnboarded: true },
    }) : null;

    const provider = caregiver || babysitter;
    if (!provider) {
      console.warn('[Webhook] No caregiver or babysitter found for Stripe account:', account.id);
      return;
    }

    const isOnboarded = account.details_submitted === true;
    const canReceive = account.charges_enabled === true && account.payouts_enabled === true;

    // Update caregiver or babysitter record
    if (caregiver) {
      const wasReceiving = caregiver.canReceivePayments;
      await db.caregiver.update({
        where: { id: caregiver.id },
        data: {
          stripeOnboarded: isOnboarded,
          canReceivePayments: canReceive,
        },
      });

      // Notify if payments just became enabled
      if (canReceive && !wasReceiving) {
        await db.notification.create({
          data: {
            userId: caregiver.userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Stripe Account Ready',
            message: 'Your Stripe account is now fully set up. You can receive payments for bookings.',
            resourceType: 'stripe_account',
            resourceId: account.id,
          },
        });
      }
    } else if (babysitter) {
      const wasOnboarded = babysitter.stripeOnboarded;
      await db.babysitter.update({
        where: { id: babysitter.id },
        data: {
          stripeOnboarded: isOnboarded,
        },
      });

      if (isOnboarded && !wasOnboarded) {
        await db.notification.create({
          data: {
            userId: babysitter.userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Stripe Account Ready',
            message: 'Your Stripe account is now fully set up. You can receive platform payments.',
            resourceType: 'stripe_account',
            resourceId: account.id,
          },
        });
      }
    }

    // Notify if there are pending requirements
    if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      await db.notification.create({
        data: {
          userId: provider.userId,
          type: 'BOOKING_UPDATE',
          title: 'Stripe Action Required',
          message: `Your Stripe account has pending requirements: ${account.requirements.currently_due.join(', ')}. Please complete them to continue receiving payments.`,
          resourceType: 'stripe_account',
          resourceId: account.id,
        },
      });
    }

    console.log('[Webhook] Account update processed for:', account.id);
  } catch (error: unknown) {
    console.error('[Webhook] Error handling account update:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  console.log('[Webhook] Processing successful payout:', {
    payoutId: payout.id,
    amount: payout.amount,
    destination: payout.destination,
    arrivalDate: payout.arrival_date,
  });

  try {
    const { default: db } = await import('@/lib/db');

    // Payout destination is the Connect account ID (from the event's account field)
    // For Connect payouts, the event is sent to our webhook with the connected account context
    // We need to find the caregiver/babysitter by their Stripe account
    const connectAccountId = (payout as Stripe.Payout & { account?: string }).account;

    if (!connectAccountId) {
      console.warn('[Webhook] Payout event missing account context:', payout.id);
      return;
    }

    const caregiver = await db.caregiver.findFirst({
      where: { stripeAccountId: connectAccountId },
      select: { userId: true },
    });

    const babysitter = !caregiver ? await db.babysitter.findFirst({
      where: { stripeConnectId: connectAccountId },
      select: { userId: true },
    }) : null;

    const provider = caregiver || babysitter;
    if (!provider) {
      console.warn('[Webhook] No provider found for payout account:', connectAccountId);
      return;
    }

    const amount = (payout.amount / 100).toFixed(2);

    await db.notification.create({
      data: {
        userId: provider.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Payout Sent',
        message: `A payout of $${amount} CAD has been sent to your bank account. It should arrive within 1-2 business days.`,
        resourceType: 'payout',
        resourceId: payout.id,
      },
    });

    console.log('[Webhook] Provider notified of payout:', payout.id);
  } catch (error: unknown) {
    console.error('[Webhook] Error handling payout paid:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handlePayoutFailed(failedPayout: Stripe.Payout) {
  console.log('[Webhook] Processing failed payout:', {
    payoutId: failedPayout.id,
    failureCode: failedPayout.failure_code,
    failureMessage: failedPayout.failure_message,
  });

  try {
    const { default: db } = await import('@/lib/db');

    const connectAccountId = (failedPayout as Stripe.Payout & { account?: string }).account;

    if (!connectAccountId) {
      console.warn('[Webhook] Failed payout event missing account context:', failedPayout.id);
      return;
    }

    const caregiver = await db.caregiver.findFirst({
      where: { stripeAccountId: connectAccountId },
      select: { userId: true },
    });

    const babysitter = !caregiver ? await db.babysitter.findFirst({
      where: { stripeConnectId: connectAccountId },
      select: { userId: true },
    }) : null;

    const provider = caregiver || babysitter;
    if (!provider) {
      console.warn('[Webhook] No provider found for failed payout account:', connectAccountId);
      return;
    }

    const amount = (failedPayout.amount / 100).toFixed(2);
    const failureMessage = failedPayout.failure_message || 'Unknown error';

    await db.notification.create({
      data: {
        userId: provider.userId,
        type: 'PAYMENT_FAILED',
        title: 'Payout Failed',
        message: `Your payout of $${amount} CAD failed: ${failureMessage}. Please check your bank details in your Stripe dashboard.`,
        resourceType: 'payout',
        resourceId: failedPayout.id,
      },
    });

    console.log('[Webhook] Provider notified of failed payout:', failedPayout.id);
  } catch (error: unknown) {
    console.error('[Webhook] Error handling failed payout:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}