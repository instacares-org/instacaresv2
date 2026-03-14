import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getStripeInstance } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return ApiErrors.badRequest('Account ID is required');
    }

    // Check if this is a demo account
    if (accountId.startsWith('acct_demo_')) {
      // Return demo status - NOT ready for real payments
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

    // Real Stripe account check — resolve at request time, not module load
    const stripe = getStripeInstance();
    if (!stripe) {
      return ApiErrors.internal('Stripe is not configured');
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

    return apiSuccess({
      accountId: account.id,
      canReceivePayments,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error('Stripe account status error:', error);
    return ApiErrors.internal('Failed to retrieve account status');
  }
}