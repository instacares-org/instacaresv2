import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// API to track pending payouts for demo accounts
export async function GET(request: NextRequest) {
  try {
    // Get all bookings with demo caregiver accounts that have been paid but caregiver hasn't received money
    const pendingPayouts = await db.booking.findMany({
      where: {
        status: 'COMPLETED',
        payments: {
          some: {
            status: 'PAID'
          }
        },
        // Find caregivers with demo accounts
        caregiverData: {
          stripeAccountId: {
            startsWith: 'acct_demo_'
          }
        }
      },
      include: {
        parent: {
          include: {
            profile: true
          }
        },
        caregiver: {
          include: {
            profile: true
          }
        },
        caregiverData: true,
        payments: {
          where: {
            status: 'PAID'
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    // Calculate pending amounts
    const payoutSummary = pendingPayouts.map(booking => {
      const totalPaid = booking.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const platformFee = booking.payments.reduce((sum, payment) => sum + payment.platformFee, 0);
      const caregiverOwed = totalPaid - platformFee;

      return {
        bookingId: booking.id,
        caregiverId: booking.caregiverId,
        caregiverName: `${booking.caregiver.profile?.firstName} ${booking.caregiver.profile?.lastName}`,
        caregiverEmail: booking.caregiver.email,
        parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
        bookingDate: booking.startTime,
        completedDate: booking.completedAt,
        totalPaid: totalPaid / 100, // Convert from cents
        platformFee: platformFee / 100,
        caregiverOwed: caregiverOwed / 100,
        hourlyRate: booking.hourlyRate,
        totalHours: booking.totalHours,
        stripeAccountId: booking.caregiverData?.stripeAccountId,
        isDemo: booking.caregiverData?.stripeAccountId?.startsWith('acct_demo_') || false
      };
    });

    // Group by caregiver
    const caregiverPayouts = new Map();
    payoutSummary.forEach(payout => {
      if (!caregiverPayouts.has(payout.caregiverId)) {
        caregiverPayouts.set(payout.caregiverId, {
          caregiverId: payout.caregiverId,
          caregiverName: payout.caregiverName,
          caregiverEmail: payout.caregiverEmail,
          stripeAccountId: payout.stripeAccountId,
          isDemo: payout.isDemo,
          totalOwed: 0,
          bookingCount: 0,
          bookings: []
        });
      }
      
      const caregiver = caregiverPayouts.get(payout.caregiverId);
      caregiver.totalOwed += payout.caregiverOwed;
      caregiver.bookingCount += 1;
      caregiver.bookings.push(payout);
    });

    const caregiverPayoutArray = Array.from(caregiverPayouts.values());
    const totalOwed = caregiverPayoutArray.reduce((sum, c) => sum + c.totalOwed, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalCaregivers: caregiverPayoutArray.length,
        totalBookings: pendingPayouts.length,
        totalOwed: totalOwed,
        demoAccounts: caregiverPayoutArray.filter(c => c.isDemo).length
      },
      caregivers: caregiverPayoutArray,
      rawBookings: payoutSummary
    });

  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending payouts' },
      { status: 500 }
    );
  }
}

// Mark payout as manually sent
export async function POST(request: NextRequest) {
  try {
    const { bookingIds, caregiverId, method, notes, amount } = await request.json();

    if (!bookingIds || !caregiverId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create manual payout record
    const manualPayout = await db.manualPayout.create({
      data: {
        caregiverId,
        amount: Math.round(amount * 100), // Convert to cents
        method: method || 'MANUAL',
        notes: notes || '',
        status: 'SENT',
        bookingIds: bookingIds.join(','), // Convert array to comma-separated string
        processedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      payoutId: manualPayout.id,
      message: `Manual payout of $${amount} recorded for caregiver`
    });

  } catch (error) {
    console.error('Error recording manual payout:', error);
    return NextResponse.json(
      { error: 'Failed to record manual payout' },
      { status: 500 }
    );
  }
}