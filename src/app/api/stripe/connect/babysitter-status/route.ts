import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Handle demo accounts
    if (accountId.startsWith('acct_demo_')) {
      return NextResponse.json({
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
        message: 'This is a demo account. Please complete real Stripe Connect setup to receive payments.'
      });
    }

    // Real Stripe account check
    const stripe = getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
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

    return NextResponse.json({
      accountId: account.id,
      canReceivePayments,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error('Babysitter Stripe account status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve account status' },
      { status: 500 }
    );
  }
}
