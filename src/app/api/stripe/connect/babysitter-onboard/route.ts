import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { db } from '@/lib/db';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Require authentication (babysitters have userType=CAREGIVER)
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized babysitter Stripe Connect onboarding attempt', {
        endpoint: '/api/stripe/connect/babysitter-onboard',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user;
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication error: user data missing' },
        { status: 401 }
      );
    }

    // Verify babysitter profile exists
    const babysitterProfile = await db.babysitter.findFirst({
      where: { userId: user.id }
    });

    if (!babysitterProfile) {
      logger.security('Stripe onboarding attempted without babysitter profile', {
        userId: user.id,
        email: user.email
      });
      return NextResponse.json(
        { error: 'Babysitter profile not found. Please complete your profile first.' },
        { status: 404 }
      );
    }

    // Check if already has Stripe account - generate new account link for verification
    if (babysitterProfile.stripeConnectId) {
      // Skip demo accounts - they need to start fresh with real setup
      if (babysitterProfile.stripeConnectId.startsWith('acct_demo_')) {
        logger.info('Demo account detected, clearing for real setup', {
          babysitterId: babysitterProfile.id,
          userId: user.id,
          demoAccountId: babysitterProfile.stripeConnectId
        });
        await db.babysitter.update({
          where: { id: babysitterProfile.id },
          data: { stripeConnectId: null }
        });
      } else {
        // Real Stripe account exists - return for embedded onboarding
        logger.info('Stripe account exists, returning for embedded onboarding', {
          babysitterId: babysitterProfile.id,
          userId: user.id,
          stripeConnectId: babysitterProfile.stripeConnectId
        });

        return NextResponse.json({
          accountId: babysitterProfile.stripeConnectId,
          mode: 'embedded',
        });
      }
    }

    // Check if we're in demo mode
    const DEMO_MODE = process.env.STRIPE_CONNECT_ENABLED !== 'true';

    logger.info('Babysitter Stripe Connect onboarding initiated', {
      userId: user.id,
      babysitterId: babysitterProfile.id,
      email: user.email,
      demoMode: DEMO_MODE
    });

    if (DEMO_MODE) {
      const demoAccountId = 'acct_demo_' + Date.now();

      await db.babysitter.update({
        where: { id: babysitterProfile.id },
        data: { stripeConnectId: demoAccountId }
      });

      const host = request.headers.get('host') || 'localhost:3005';
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${protocol}://${host}`;
      const demoOnboardingUrl = `${baseUrl}/caregiver-dashboard?tab=payments&setup=success&demo=true`;

      logger.info('Demo Stripe account created for babysitter', {
        userId: user.id,
        babysitterId: babysitterProfile.id,
        demoAccountId
      });

      return NextResponse.json({
        accountId: demoAccountId,
        onboardingUrl: demoOnboardingUrl,
        demo: true,
        message: 'Demo mode active. Set STRIPE_CONNECT_ENABLED=true to enable real payments.'
      });
    }

    // Real Stripe Connect mode
    const stripe = getStripeInstance();

    if (!stripe) {
      logger.warn('Stripe not configured, falling back to demo mode');
      const demoAccountId = 'acct_demo_' + Date.now();

      await db.babysitter.update({
        where: { id: babysitterProfile.id },
        data: { stripeConnectId: demoAccountId }
      });

      const host = request.headers.get('host') || 'localhost:3005';
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${protocol}://${host}`;
      const demoOnboardingUrl = `${baseUrl}/caregiver-dashboard?tab=payments&setup=success&demo=true`;

      return NextResponse.json({
        accountId: demoAccountId,
        onboardingUrl: demoOnboardingUrl,
        demo: true,
        message: 'Demo mode active. Configure STRIPE_SECRET_KEY to enable real payments.'
      });
    }

    // Fetch user profile data to pre-fill Stripe onboarding
    let userCountry = 'CA';
    let userProfile: any = null;
    try {
      userProfile = await db.userProfile.findUnique({
        where: { userId: user.id },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          streetAddress: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          dateOfBirth: true,
        }
      });
      if (userProfile?.country) {
        userCountry = userProfile.country;
      }
    } catch (error) {
      logger.error('Error fetching user profile for pre-fill', { error });
    }

    // Build individual data for pre-filling Stripe onboarding
    const individual: Record<string, any> = {};
    if (userProfile?.firstName) individual.first_name = userProfile.firstName;
    if (userProfile?.lastName) individual.last_name = userProfile.lastName;
    if (userProfile?.phone) individual.phone = userProfile.phone;
    if (userProfile?.dateOfBirth) {
      const dob = new Date(userProfile.dateOfBirth);
      individual.dob = {
        day: dob.getDate(),
        month: dob.getMonth() + 1,
        year: dob.getFullYear(),
      };
    }
    if (userProfile?.streetAddress || userProfile?.city || userProfile?.state || userProfile?.zipCode) {
      individual.address = {
        ...(userProfile.streetAddress && { line1: userProfile.streetAddress }),
        ...(userProfile.city && { city: userProfile.city }),
        ...(userProfile.state && { state: userProfile.state }),
        ...(userProfile.zipCode && { postal_code: userProfile.zipCode }),
        country: userCountry,
      };
    }

    // Create Stripe Express account with pre-filled data
    const account = await stripe.accounts.create({
      type: 'express',
      country: userCountry,
      email: user.email,
      business_type: 'individual',
      business_profile: {
        mcc: '7299',
        url: 'https://instacares.com',
        product_description: 'Babysitting and childcare services',
      },
      individual: Object.keys(individual).length > 0 ? individual : undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            delay_days: 7,
            interval: 'daily'
          }
        }
      },
      metadata: {
        babysitterId: babysitterProfile.id,
        userId: user.id,
        platform: 'InstaCares',
        role: 'babysitter'
      }
    });

    // Store Stripe account ID
    await db.babysitter.update({
      where: { id: babysitterProfile.id },
      data: { stripeConnectId: account.id }
    });

    logger.security('Babysitter Stripe Connect account created', {
      userId: user.id,
      babysitterId: babysitterProfile.id,
      stripeAccountId: account.id,
      email: user.email
    });

    return NextResponse.json({
      accountId: account.id,
      mode: 'embedded',
    });
  } catch (error: unknown) {
    console.error('Babysitter Stripe Connect onboarding error:', error);
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    const errType = error instanceof Error ? (error as Error & { type?: string }).type : undefined;
    const errCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    logger.error('Babysitter Stripe Connect onboarding error', {
      error: errMessage,
      type: errType,
      code: errCode
    });

    return NextResponse.json(
      {
        error: 'Failed to create Stripe Connect account',
        details: errMessage,
        type: errType
      },
      { status: 500 }
    );
  }
}
