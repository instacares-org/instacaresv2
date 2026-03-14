import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getStripeInstance } from '@/lib/stripe';
import { withAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // --- RATE LIMITING ---
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return ApiErrors.tooManyRequests('Too many requests. Please try again later.');
    }

    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    const { accountId } = await request.json();
    if (!accountId) {
      return ApiErrors.badRequest('Account ID required');
    }

    // Verify the requesting user owns this Stripe account
    const authUser = authResult.user!;
    const caregiver = await db.caregiver.findFirst({
      where: { userId: authUser.id, stripeAccountId: accountId }
    });
    const babysitter = await db.babysitter.findFirst({
      where: { userId: authUser.id, stripeConnectId: accountId }
    });

    if (!caregiver && !babysitter) {
      logger.security('Account session requested for unowned account', {
        userId: authUser.id,
        accountId,
      });
      return ApiErrors.forbidden('Account not found');
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe not configured');
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return apiSuccess({ clientSecret: accountSession.client_secret });
  } catch (error: any) {
    console.error('Account session error:', error);
    logger.error('Failed to create account session', {
      error: error.message,
    });
    return ApiErrors.internal('Failed to create account session');
  }
}
