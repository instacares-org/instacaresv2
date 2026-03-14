import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger, getClientInfo } from '@/lib/logger';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const manualPayoutSchema = z.object({
  bookingIds: z.array(z.string().min(1, 'Booking ID cannot be empty')).min(1, 'At least one booking ID is required'),
  caregiverId: z.string().min(1, 'Caregiver ID is required'),
  method: z.string().max(50, 'Method too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  amount: z.number().positive('Amount must be a positive number'),
});

// API to track pending payouts for demo accounts
export async function GET(request: NextRequest) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canProcessPayouts');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;

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
        caregiverProfile: {
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
        caregiverUser: {
          include: {
            profile: true
          }
        },
        caregiverProfile: true,
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
        caregiverName: `${booking.caregiverUser.profile?.firstName} ${booking.caregiverUser.profile?.lastName}`,
        caregiverEmail: booking.caregiverUser.email,
        parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
        bookingDate: booking.startTime,
        completedDate: booking.completedAt,
        totalPaid: totalPaid / 100, // Convert from cents
        platformFee: platformFee / 100,
        caregiverOwed: caregiverOwed / 100,
        hourlyRate: booking.hourlyRate,
        totalHours: booking.totalHours,
        stripeAccountId: booking.caregiverProfile?.stripeAccountId,
        isDemo: booking.caregiverProfile?.stripeAccountId?.startsWith('acct_demo_') || false
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

    // ✅ STEP 2: Log admin access to financial data
    logger.info('Admin payouts data accessed', {
      adminId: adminUser.id,
      totalCaregivers: caregiverPayoutArray.length,
      totalOwed: totalOwed
    });

    return apiSuccess({
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
    logger.error('Admin payouts fetch error', { error });
    return ApiErrors.internal('Failed to fetch pending payouts');
  }
}

// Mark payout as manually sent
export async function POST(request: NextRequest) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canProcessPayouts');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;

    const body = await request.json();
    const parsed = manualPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { bookingIds, caregiverId, method, notes, amount } = parsed.data;

    // ✅ STEP 2: Log manual payout creation (CRITICAL for audit trail)
    logger.security('Manual payout triggered', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      caregiverId,
      amount,
      method: method || 'MANUAL',
      bookingIds,
      notes
    });

    // Create manual payout record
    const manualPayout = await db.manualPayout.create({
      data: {
        caregiverId,
        amount: Math.round(amount * 100), // Convert to cents
        method: method || 'MANUAL',
        notes: notes ? `${notes} [processedBy: ${adminUser.id}]` : `[processedBy: ${adminUser.id}]`,
        status: 'SENT',
        bookingIds: bookingIds.join(','), // Convert array to comma-separated string
        processedAt: new Date(),
      }
    });

    logger.info('Manual payout created', {
      payoutId: manualPayout.id,
      adminId: adminUser.id,
      caregiverId,
      amount
    });

    return apiSuccess({
      payoutId: manualPayout.id,
    }, `Manual payout of $${amount} recorded for caregiver`);

  } catch (error) {
    console.error('Error recording manual payout:', error);
    logger.error('Manual payout creation error', { error });
    return ApiErrors.internal('Failed to record manual payout');
  }
}
