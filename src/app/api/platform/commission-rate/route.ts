import { NextRequest, NextResponse } from 'next/server';
import { getCommissionRate, DEFAULT_COMMISSION_RATE } from '@/lib/stripe';
import { withAuth } from '@/lib/auth-middleware';

/**
 * GET /api/platform/commission-rate
 * Returns the current platform commission rate (authenticated users only)
 * Used by booking components to display accurate fee breakdowns
 */
export async function GET(request: NextRequest) {
  // Require any authenticated user (parents/caregivers making bookings)
  const authResult = await withAuth(request, 'ANY');
  if (!authResult.isAuthorized) {
    return authResult.response;
  }

  try {
    const commissionRate = await getCommissionRate();

    return NextResponse.json({
      success: true,
      commissionRate: commissionRate, // As decimal (e.g., 0.10 for 10%)
      commissionPercentage: Math.round(commissionRate * 100), // As percentage (e.g., 10 for 10%)
    });
  } catch (error) {
    console.error('Error fetching commission rate:', error);

    // Return default rate on error (don't expose internal errors)
    return NextResponse.json({
      success: true,
      commissionRate: DEFAULT_COMMISSION_RATE,
      commissionPercentage: Math.round(DEFAULT_COMMISSION_RATE * 100),
    });
  }
}
