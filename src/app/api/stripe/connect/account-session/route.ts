import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';
import { withAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    const { accountId } = await request.json();
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Account not found' }, { status: 403 });
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return NextResponse.json({ clientSecret: accountSession.client_secret });
  } catch (error: any) {
    console.error('Account session error:', error);
    logger.error('Failed to create account session', {
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to create account session' },
      { status: 500 }
    );
  }
}
