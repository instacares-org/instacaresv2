import { NextRequest, NextResponse } from 'next/server';
import { stripe, calculateCommission } from '@/lib/stripe';
import { processPaymentAmount, isDemoMode, isTestMode, getCurrentConfig } from '@/lib/payment-modes';

interface BookingRequest {
  caregiverStripeAccountId: string;
  amount: number; // Amount in cents
  parentEmail: string;
  caregiverName: string;
  caregiverId?: string;
  bookingDetails: {
    date: string;
    startTime: string;
    endTime: string;
    childrenCount: number;
    specialRequests?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      caregiverStripeAccountId,
      amount,
      parentEmail,
      caregiverName,
      caregiverId,
      bookingDetails,
    }: BookingRequest = await request.json();

    // Validate required fields
    if (!caregiverStripeAccountId || !amount || !parentEmail) {
      return NextResponse.json(
        { error: 'Missing required booking information' },
        { status: 400 }
      );
    }

    // Process amount based on payment mode
    const processedAmount = processPaymentAmount(amount);
    const commissionAmount = calculateCommission(processedAmount);
    const paymentConfig = getCurrentConfig();
    
    console.log('Payment creation:', {
      mode: paymentConfig.name,
      originalAmount: amount / 100,
      processedAmount: processedAmount / 100,
      commission: commissionAmount / 100
    });

    // Handle demo mode with simulated payment
    if (isDemoMode()) {
      console.log('Demo mode: Simulating payment without Stripe API call');
      
      // Generate a fake payment intent ID for demo
      const fakePaymentIntentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fakeClientSecret = `${fakePaymentIntentId}_secret_demo`;
      
      return NextResponse.json({
        clientSecret: fakeClientSecret,
        paymentIntentId: fakePaymentIntentId,
        amount: processedAmount,
        originalAmount: amount,
        commission: commissionAmount,
        caregiverPayout: processedAmount - commissionAmount,
        mode: paymentConfig.name,
        demo: true,
      });
    }

    // Check if this is a demo account
    if (caregiverStripeAccountId.startsWith('acct_demo_') || caregiverStripeAccountId === 'acct_test_demo') {
      // Create a regular payment intent for demo (without Connect features)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: processedAmount,
        currency: 'usd',
        metadata: {
          bookingDate: bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date,
          endDate: bookingDetails.isMultiDay ? bookingDetails.endDate : bookingDetails.date,
          isMultiDay: bookingDetails.isMultiDay ? 'true' : 'false',
          startTime: bookingDetails.startTime,
          endTime: bookingDetails.endTime,
          childrenCount: bookingDetails.childrenCount.toString(),
          caregiverName,
          caregiverId: caregiverId || '',
          parentEmail,
          specialRequests: bookingDetails.specialRequests || '',
          address: bookingDetails.address || '',
          latitude: bookingDetails.latitude?.toString() || '',
          longitude: bookingDetails.longitude?.toString() || '',
          demoMode: 'true',
          platformCommission: commissionAmount.toString(),
        },
        receipt_email: parentEmail,
        description: `Childcare booking with ${caregiverName} on ${bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date} (Demo)`,
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: processedAmount,
        originalAmount: amount,
        commission: commissionAmount,
        caregiverPayout: processedAmount - commissionAmount,
        mode: paymentConfig.name,
        demo: true,
      });
    }

    // Real Stripe Connect payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: processedAmount,
      currency: 'usd',
      application_fee_amount: commissionAmount,
      transfer_data: {
        destination: caregiverStripeAccountId,
      },
      metadata: {
        bookingDate: bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date,
        endDate: bookingDetails.isMultiDay ? bookingDetails.endDate : bookingDetails.date,
        isMultiDay: bookingDetails.isMultiDay ? 'true' : 'false',
        startTime: bookingDetails.startTime,
        endTime: bookingDetails.endTime,
        childrenCount: bookingDetails.childrenCount.toString(),
        caregiverName,
        caregiverId: caregiverId || '',
        parentEmail,
        specialRequests: bookingDetails.specialRequests || '',
        address: bookingDetails.address || '',
        latitude: bookingDetails.latitude?.toString() || '',
        longitude: bookingDetails.longitude?.toString() || '',
      },
      receipt_email: parentEmail,
      description: `Childcare booking with ${caregiverName} on ${bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: processedAmount,
      originalAmount: amount,
      commission: commissionAmount,
      caregiverPayout: processedAmount - commissionAmount,
      mode: paymentConfig.name,
    });
  } catch (error: any) {
    console.error('Booking payment creation error:', error);
    
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