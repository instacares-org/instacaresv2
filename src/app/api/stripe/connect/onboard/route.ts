import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getStripeInstance } from '@/lib/stripe';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { db } from '@/lib/db';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

const stripeOnboardBodySchema = z.object({
  caregiverName: z.string().max(200, 'Caregiver name too long').trim().optional(),
  phone: z.string().max(30, 'Phone number too long').trim().optional(),
  address: z.object({
    line1: z.string().max(300).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(10).optional(),
  }).optional(),
});

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // --- RATE LIMITING ---
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.PROFILE_UPDATE);
    if (!rateLimitResult.success) {
      return ApiErrors.tooManyRequests('Too many requests. Please try again later.');
    }

    // ✅ STEP 1: Require caregiver authentication
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized Stripe Connect onboarding attempt', {
        endpoint: '/api/stripe/connect/onboard',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const caregiverUser = authResult.user;
    if (!caregiverUser) {
      return ApiErrors.unauthorized('Authentication error: user data missing');
    }

    const rawBody = await request.json();
    const parsed = stripeOnboardBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { caregiverName, phone, address } = parsed.data;

    // ✅ STEP 2: Verify caregiver profile exists and belongs to authenticated user
    const caregiverProfile = await db.caregiver.findFirst({
      where: { userId: caregiverUser.id }
    });

    if (!caregiverProfile) {
      logger.security('Stripe onboarding attempted without caregiver profile', {
        userId: caregiverUser.id,
        email: caregiverUser.email
      });
      return ApiErrors.notFound('Caregiver profile not found. Please complete your profile first.');
    }

    // ✅ STEP 3: Check if already has Stripe account - generate new account link for verification
    if (caregiverProfile.stripeAccountId) {
      // Skip demo accounts - they need to start fresh with real setup
      if (caregiverProfile.stripeAccountId.startsWith('acct_demo_')) {
        logger.info('Demo account detected, clearing for real setup', {
          caregiverId: caregiverProfile.id,
          userId: caregiverUser.id,
          demoAccountId: caregiverProfile.stripeAccountId
        });
        // Clear demo account to allow real setup
        await db.caregiver.update({
          where: { id: caregiverProfile.id },
          data: { stripeAccountId: null }
        });
        // Continue to create real account below
      } else {
        // Real Stripe account exists - return for embedded onboarding
        logger.info('Stripe account exists, returning for embedded onboarding', {
          caregiverId: caregiverProfile.id,
          userId: caregiverUser.id,
          stripeAccountId: caregiverProfile.stripeAccountId
        });

        return apiSuccess({
          accountId: caregiverProfile.stripeAccountId,
          mode: 'embedded',
        });
      }
    }

    // Check if we're in demo mode based on environment variable
    const DEMO_MODE = process.env.STRIPE_CONNECT_ENABLED !== 'true';

    logger.info('Stripe Connect onboarding initiated', {
      userId: caregiverUser.id,
      caregiverId: caregiverProfile.id,
      email: caregiverUser.email,
      demoMode: DEMO_MODE
    });

    if (DEMO_MODE) {
      // Demo mode - simulate successful account creation
      const demoAccountId = 'acct_demo_' + Date.now();

      // ✅ Store demo account ID in database
      await db.caregiver.update({
        where: { id: caregiverProfile.id },
        data: { stripeAccountId: demoAccountId }
      });

      // Get the host and protocol from the request headers for dynamic URL
      const host = request.headers.get('host') || process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') || 'instacares.net';
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;
      const demoOnboardingUrl = `${baseUrl}/caregiver-dashboard?setup=success&demo=true`;

      logger.info('Demo Stripe account created', {
        userId: caregiverUser.id,
        caregiverId: caregiverProfile.id,
        demoAccountId
      });

      return apiSuccess({
        accountId: demoAccountId,
        onboardingUrl: demoOnboardingUrl,
        demo: true,
      }, 'Demo mode active. Set STRIPE_CONNECT_ENABLED=true to enable real payments.');
    }

    // Real Stripe Connect mode (when enabled)
    const stripe = getStripeInstance();

    if (!stripe) {
      // Fallback to demo mode if Stripe is not configured
      logger.warn('Stripe not configured, falling back to demo mode');
      const demoAccountId = 'acct_demo_' + Date.now();

      await db.caregiver.update({
        where: { id: caregiverProfile.id },
        data: { stripeAccountId: demoAccountId }
      });

      const host = request.headers.get('host') || process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') || 'instacares.net';
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;
      const demoOnboardingUrl = `${baseUrl}/caregiver-dashboard?setup=success&demo=true`;

      return apiSuccess({
        accountId: demoAccountId,
        onboardingUrl: demoOnboardingUrl,
        demo: true,
      }, 'Demo mode active. Configure STRIPE_SECRET_KEY to enable real payments.');
    }

    // Fetch user profile data to pre-fill Stripe onboarding
    let userCountry = 'US'; // Default to US
    let userProfile: any = null;
    try {
      userProfile = await db.userProfile.findUnique({
        where: { userId: caregiverUser.id },
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
        logger.info('User country from database', { userId: caregiverUser.id, country: userCountry });
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
    // Pre-fill job title for the onboarding form
    individual.relationship = { title: 'Caregiver' };

    // ✅ Create Stripe account with pre-filled data from user profile
    const account = await stripe.accounts.create({
      type: 'express',
      country: userCountry,
      email: caregiverUser.email, // ✅ Use session email, not client-provided
      business_type: 'individual',
      business_profile: {
        mcc: '7299',
        url: 'https://instacares.com',
        product_description: 'Caregiving and childcare services',
      },
      individual: Object.keys(individual).length > 0 ? individual : undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            delay_days: 7,  // Hold funds for 7 days to allow for refunds
            interval: 'daily'
          }
        }
      },
      metadata: {
        caregiverId: caregiverProfile.id,
        userId: caregiverUser.id,
        platform: 'InstaCares'
      }
    });

    // ✅ STEP 4: Store Stripe account ID in database
    await db.caregiver.update({
      where: { id: caregiverProfile.id },
      data: { stripeAccountId: account.id }
    });

    logger.security('Stripe Connect account created', {
      userId: caregiverUser.id,
      caregiverId: caregiverProfile.id,
      stripeAccountId: account.id,
      email: caregiverUser.email
    });

    return apiSuccess({
      accountId: account.id,
      mode: 'embedded',
    });
  } catch (error: unknown) {
    console.error('Stripe Connect onboarding error:', error);
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    const errType = error instanceof Error ? (error as Error & { type?: string }).type : undefined;
    const errCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    logger.error('Stripe Connect onboarding error', {
      error: errMessage,
      type: errType,
      code: errCode
    });

    return ApiErrors.internal('Failed to create Stripe Connect account');
  }
}
