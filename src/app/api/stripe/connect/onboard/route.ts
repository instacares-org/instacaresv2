import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { email, caregiverName, phone, address } = await request.json();

    console.log('Creating Stripe Connect account for:', { email, caregiverName });

    // Check if we're in demo mode based on environment variable
    const DEMO_MODE = process.env.STRIPE_CONNECT_ENABLED !== 'true';
    
    console.log('Stripe Connect Onboarding Request:', {
      email,
      caregiverName,
      demoMode: DEMO_MODE,
      stripeConnectEnabled: process.env.STRIPE_CONNECT_ENABLED
    });

    if (DEMO_MODE) {
      // Demo mode - simulate successful account creation
      console.log('Demo mode: Simulating Stripe Connect onboarding');
      console.log('To enable real Stripe Connect, set STRIPE_CONNECT_ENABLED=true in your .env file');
      
      const demoAccountId = 'acct_demo_' + Date.now();
      
      // Get the host and protocol from the request headers for dynamic URL
      const host = request.headers.get('host') || 'localhost:3005';
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${protocol}://${host}`;
      const demoOnboardingUrl = `${baseUrl}/caregiver-dashboard?setup=success&demo=true`;

      console.log('Demo redirect URL:', demoOnboardingUrl);

      return NextResponse.json({
        accountId: demoAccountId,
        onboardingUrl: demoOnboardingUrl,
        demo: true,
        message: 'Demo mode active. Set STRIPE_CONNECT_ENABLED=true to enable real payments.'
      });
    }

    // Real Stripe Connect mode (when enabled)
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    console.log('Stripe account created:', account.id);

    // Get the host and protocol from the request headers for dynamic URL
    const host = request.headers.get('host') || 'localhost:3005';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/caregiver-dashboard?setup=failed`,
      return_url: `${baseUrl}/caregiver-dashboard?setup=success`,
      type: 'account_onboarding',
    });

    console.log('Account link created:', accountLink.url);

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error: any) {
    console.error('Stripe Connect onboarding error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      statusCode: error.statusCode,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to create Stripe Connect account',
        details: error.message,
        type: error.type 
      },
      { status: 500 }
    );
  }
}