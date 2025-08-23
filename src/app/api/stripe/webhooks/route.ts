import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(paymentIntent: any) {
  console.log('Processing successful payment:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    applicationFeeAmount: paymentIntent.application_fee_amount,
    transferDestination: paymentIntent.transfer_data?.destination,
    metadata: paymentIntent.metadata,
  });
  
  try {
    const metadata = paymentIntent.metadata;
    
    // Check if we've already processed this payment intent to prevent duplicates
    const { db } = await import('@/lib/db');
    const existingPayment = await db.payment.findFirst({
      where: { 
        stripePaymentIntentId: paymentIntent.id 
      }
    });
    
    if (existingPayment) {
      console.log('Payment already processed, skipping duplicate:', paymentIntent.id);
      return;
    }
    
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
      console.error('Missing required booking metadata:', metadata);
      return;
    }
    
    // Find parent user by email
    const { userOperations, bookingOperations, paymentOperations } = await import('@/lib/db');
    const parent = await userOperations.findUserByEmail(parentEmail);
    
    if (!parent) {
      console.error('Parent not found for email:', parentEmail);
      return;
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
    
    // Calculate totals
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const platformCommission = paymentIntent.application_fee_amount || parseInt(metadata.platformCommission || '0');
    const caregiverPayout = paymentIntent.amount - platformCommission;
    
    // Get caregiver hourly rate (estimate from total amount and hours)
    const hourlyRate = Math.round((paymentIntent.amount / 100) / totalHours);
    
    // Additional duplicate check: Look for existing booking with same details
    const existingBooking = await db.booking.findFirst({
      where: {
        parentId: parent.id,
        caregiverId: caregiverId,
        startTime: startDateTime,
        endTime: endDateTime,
      },
    });
    
    if (existingBooking) {
      console.log('Booking with same details already exists, skipping duplicate:', existingBooking.id);
      return;
    }

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
    
    // Create payment record
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
    
  } catch (error) {
    console.error('❌ Error creating booking from payment:', error);
  }
}

async function handleFailedPayment(failedPayment: any) {
  console.log('Processing failed payment:', {
    paymentIntentId: failedPayment.id,
    lastPaymentError: failedPayment.last_payment_error,
    metadata: failedPayment.metadata,
  });
  
  // Send failure notification to parent
  // Update booking status to 'payment_failed'
}

async function handleAccountUpdate(account: any) {
  console.log('Processing account update:', {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    payoutsEnabled: account.payouts_enabled,
  });
  
  // Update caregiver account status in your database
  // Notify caregiver of any required actions
}

async function handlePayoutPaid(payout: any) {
  console.log('Processing successful payout:', {
    payoutId: payout.id,
    amount: payout.amount,
    destination: payout.destination,
    arrivalDate: payout.arrival_date,
  });
  
  // Update payout records in database
  // Send payout confirmation to caregiver
}

async function handlePayoutFailed(failedPayout: any) {
  console.log('Processing failed payout:', {
    payoutId: failedPayout.id,
    failureCode: failedPayout.failure_code,
    failureMessage: failedPayout.failure_message,
  });
  
  // Notify caregiver of payout failure
  // Provide instructions for resolving the issue
}