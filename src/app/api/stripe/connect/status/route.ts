import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Check if this is a demo account
    if (accountId.startsWith('acct_demo_')) {
      // Return demo status - NOT ready for real payments
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
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }
    const account = await stripe.accounts.retrieve(accountId);

    const canReceivePayments = account.charges_enabled && account.details_submitted;

    // Sync the status to the database so caregiver cards show correct status
    try {
      await prisma.caregiver.updateMany({
        where: { stripeAccountId: accountId },
        data: {
          stripeOnboarded: account.details_submitted,
          canReceivePayments: canReceivePayments,
        }
      });
    } catch (dbError) {
      console.error('Failed to sync Stripe status to database:', dbError);
      // Don't fail the request if DB sync fails
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
    console.error('Stripe account status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve account status' },
      { status: 500 }
    );
  }
}