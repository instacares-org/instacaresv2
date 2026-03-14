import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getStripeInstance } from '@/lib/stripe';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return ApiErrors.badRequest('Account ID is required');
    }

    // Handle demo accounts
    if (accountId.startsWith('acct_demo_')) {
      return apiSuccess({
        accountId: accountId,
        canReceivePayments: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        requirements: {
          currently_due: ['Complete real Stripe Connect onboarding'],
          eventually_due: []
        },
        payoutsEnabled: false,
        isDemo: true,
      }, 'This is a demo account. Please complete real Stripe Connect setup to receive payments.');
    }

    // Real Stripe account check
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
    }

    const account = await stripe.accounts.retrieve(accountId);
    const canReceivePayments = account.charges_enabled && account.details_submitted;

    // Sync status to babysitter record in database
    try {
      await db.babysitter.updateMany({
        where: { stripeConnectId: accountId },
        data: {
          stripeOnboarded: account.details_submitted ?? false,
        }
      });
    } catch (dbError) {
      console.error('Failed to sync babysitter Stripe status to database:', dbError);
    }

    return apiSuccess({
      accountId: account.id,
      canReceivePayments,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error('Babysitter Stripe account status error:', error);
    return ApiErrors.internal('Failed to retrieve account status');
  }
}
