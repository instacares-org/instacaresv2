import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Helper to get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

// Helper to format period labels
function getPeriodLabels(period: string, startDate: Date, endDate: Date): string[] {
  const labels: string[] = [];
  const current = new Date(startDate);

  switch (period) {
    case 'week':
      while (current <= endDate) {
        labels.push(current.toLocaleDateString('en-US', { weekday: 'short' }));
        current.setDate(current.getDate() + 1);
      }
      break;
    case 'month':
      while (current <= endDate) {
        labels.push(current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        current.setDate(current.getDate() + 7);
      }
      break;
    case 'quarter':
      while (current <= endDate) {
        labels.push(current.toLocaleDateString('en-US', { month: 'short' }));
        current.setMonth(current.getMonth() + 1);
      }
      break;
    case 'year':
      while (current <= endDate) {
        labels.push(current.toLocaleDateString('en-US', { month: 'short' }));
        current.setMonth(current.getMonth() + 1);
      }
      break;
  }

  return labels;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    const { startDate, endDate } = getDateRange(period);
    const caregiverId = session.user.id;

    // Fetch all bookings for this caregiver in the period
    const bookings = await db.booking.findMany({
      where: {
        caregiverId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        parent: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        payments: true,
        reviews: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch all reviews for this caregiver
    const reviews = await db.review.findMany({
      where: {
        revieweeId: caregiverId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch historical bookings for client retention analysis
    const allTimeBookings = await db.booking.findMany({
      where: {
        caregiverId,
        status: 'COMPLETED'
      },
      select: {
        parentId: true,
        createdAt: true,
        totalAmount: true
      }
    });

    // Calculate earnings data
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED');
    const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.totalAmount - b.platformFee), 0);
    const totalHours = completedBookings.reduce((sum, b) => sum + b.totalHours, 0);
    const avgHourlyRate = totalHours > 0 ? totalEarnings / totalHours : 0;

    // Group earnings by period
    const earningsByPeriod: Record<string, { earnings: number; hours: number; bookings: number }> = {};
    const labels = getPeriodLabels(period, startDate, endDate);

    labels.forEach(label => {
      earningsByPeriod[label] = { earnings: 0, hours: 0, bookings: 0 };
    });

    completedBookings.forEach(booking => {
      let label: string;
      const bookingDate = new Date(booking.createdAt);

      switch (period) {
        case 'week':
          label = bookingDate.toLocaleDateString('en-US', { weekday: 'short' });
          break;
        case 'month':
          // Find the closest week label
          const weekStart = new Date(startDate);
          while (weekStart <= bookingDate) {
            label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            weekStart.setDate(weekStart.getDate() + 7);
          }
          label = label!;
          break;
        default:
          label = bookingDate.toLocaleDateString('en-US', { month: 'short' });
      }

      if (earningsByPeriod[label]) {
        earningsByPeriod[label].earnings += (booking.totalAmount - booking.platformFee);
        earningsByPeriod[label].hours += booking.totalHours;
        earningsByPeriod[label].bookings += 1;
      }
    });

    const earningsTrend = labels.map(label => ({
      period: label,
      earnings: Math.round(earningsByPeriod[label]?.earnings || 0),
      hours: Math.round((earningsByPeriod[label]?.hours || 0) * 10) / 10,
      bookings: earningsByPeriod[label]?.bookings || 0
    }));

    // Calculate earnings breakdown by service type (based on children count)
    const earningsBreakdown = [
      {
        name: 'Single Child',
        value: completedBookings.filter(b => b.childrenCount === 1).reduce((sum, b) => sum + (b.totalAmount - b.platformFee), 0),
        color: '#3B82F6'
      },
      {
        name: 'Multiple Children',
        value: completedBookings.filter(b => b.childrenCount > 1).reduce((sum, b) => sum + (b.totalAmount - b.platformFee), 0),
        color: '#10B981'
      }
    ];

    // Calculate hourly analysis by time of day
    const hourlyAnalysis = [
      { hour: 'Morning (6-12)', bookings: 0, avgRate: 0, totalEarnings: 0 },
      { hour: 'Afternoon (12-17)', bookings: 0, avgRate: 0, totalEarnings: 0 },
      { hour: 'Evening (17-21)', bookings: 0, avgRate: 0, totalEarnings: 0 },
      { hour: 'Night (21-6)', bookings: 0, avgRate: 0, totalEarnings: 0 }
    ];

    completedBookings.forEach(booking => {
      const startHour = new Date(booking.startTime).getHours();
      let index: number;

      if (startHour >= 6 && startHour < 12) index = 0;
      else if (startHour >= 12 && startHour < 17) index = 1;
      else if (startHour >= 17 && startHour < 21) index = 2;
      else index = 3;

      hourlyAnalysis[index].bookings += 1;
      hourlyAnalysis[index].totalEarnings += (booking.totalAmount - booking.platformFee);
    });

    hourlyAnalysis.forEach(slot => {
      slot.avgRate = slot.bookings > 0 ? Math.round(slot.totalEarnings / slot.bookings) : 0;
    });

    // Booking analytics
    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length;
    const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED').length;
    const completionRate = totalBookings > 0 ? Math.round((completedBookings.length / totalBookings) * 100) : 0;

    // Booking trends
    const bookingTrend = labels.map(label => ({
      period: label,
      bookings: earningsByPeriod[label]?.bookings || 0,
      completed: 0,
      cancelled: 0
    }));

    // Service breakdown
    const servicesBreakdown = [
      { name: 'Full Day Care', value: completedBookings.filter(b => b.totalHours >= 8).length, color: '#3B82F6' },
      { name: 'Half Day Care', value: completedBookings.filter(b => b.totalHours >= 4 && b.totalHours < 8).length, color: '#10B981' },
      { name: 'Short Sessions', value: completedBookings.filter(b => b.totalHours < 4).length, color: '#F59E0B' }
    ];

    // Timing analysis
    const timingAnalysis = hourlyAnalysis.map(slot => ({
      timeSlot: slot.hour,
      bookings: slot.bookings,
      popularity: totalBookings > 0 ? Math.round((slot.bookings / totalBookings) * 100) : 0
    }));

    // Client retention analysis
    const uniqueClients = new Set(allTimeBookings.map(b => b.parentId));
    const totalClients = uniqueClients.size;

    // Count clients with multiple bookings (returning)
    const clientBookingCounts: Record<string, number> = {};
    allTimeBookings.forEach(b => {
      clientBookingCounts[b.parentId] = (clientBookingCounts[b.parentId] || 0) + 1;
    });

    const returningClients = Object.values(clientBookingCounts).filter(count => count > 1).length;
    const newClients = totalClients - returningClients;
    const retentionRate = totalClients > 0 ? Math.round((returningClients / totalClients) * 100) : 0;

    // Calculate client segments
    const clientSegments = [
      {
        name: 'New',
        value: Object.values(clientBookingCounts).filter(count => count === 1).length,
        color: '#3B82F6'
      },
      {
        name: 'Returning',
        value: Object.values(clientBookingCounts).filter(count => count >= 2 && count <= 4).length,
        color: '#10B981'
      },
      {
        name: 'Loyal',
        value: Object.values(clientBookingCounts).filter(count => count >= 5).length,
        color: '#8B5CF6'
      }
    ];

    // Calculate average lifetime value
    const clientValues: number[] = [];
    uniqueClients.forEach(clientId => {
      const clientTotal = allTimeBookings
        .filter(b => b.parentId === clientId)
        .reduce((sum, b) => sum + b.totalAmount, 0);
      clientValues.push(clientTotal);
    });
    const avgLifetimeValue = clientValues.length > 0
      ? Math.round(clientValues.reduce((a, b) => a + b, 0) / clientValues.length)
      : 0;

    // Performance metrics
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;
    const totalReviews = reviews.length;

    // Response time (mock for now - would need message data)
    const avgResponseTime = 15; // minutes - placeholder

    // Rating breakdown
    const ratingBreakdown = [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: reviews.filter(r => Math.round(r.rating) === rating).length,
      percentage: reviews.length > 0
        ? Math.round((reviews.filter(r => Math.round(r.rating) === rating).length / reviews.length) * 100)
        : 0
    }));

    // Tax/Financial reports
    const grossIncome = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const platformFees = completedBookings.reduce((sum, b) => sum + b.platformFee, 0);
    const netIncome = grossIncome - platformFees;

    // Quarterly breakdown for tax purposes
    const quarterlyData = [
      { quarter: 'Q1', income: 0, expenses: 0 },
      { quarter: 'Q2', income: 0, expenses: 0 },
      { quarter: 'Q3', income: 0, expenses: 0 },
      { quarter: 'Q4', income: 0, expenses: 0 }
    ];

    completedBookings.forEach(booking => {
      const quarter = Math.floor(new Date(booking.createdAt).getMonth() / 3);
      quarterlyData[quarter].income += (booking.totalAmount - booking.platformFee);
      quarterlyData[quarter].expenses += booking.platformFee;
    });

    return NextResponse.json({
      success: true,
      data: {
        // Earnings data
        earnings: {
          total: Math.round(totalEarnings),
          totalHours: Math.round(totalHours * 10) / 10,
          avgHourlyRate: Math.round(avgHourlyRate),
          trend: earningsTrend,
          breakdown: earningsBreakdown,
          hourlyAnalysis
        },

        // Booking analytics
        bookings: {
          total: totalBookings,
          completed: completedBookings.length,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          cancelled: cancelledBookings,
          completionRate,
          trend: bookingTrend,
          servicesBreakdown,
          timingAnalysis
        },

        // Client retention
        retention: {
          totalClients,
          newClients,
          returningClients,
          retentionRate,
          churnRate: 100 - retentionRate,
          avgLifetimeValue,
          segments: clientSegments
        },

        // Performance metrics
        performance: {
          avgRating,
          totalReviews,
          completionRate,
          avgResponseTime,
          ratingBreakdown
        },

        // Tax/Financial reports
        financial: {
          grossIncome: Math.round(grossIncome),
          platformFees: Math.round(platformFees),
          netIncome: Math.round(netIncome),
          quarterlyData,
          estimatedTax: Math.round(netIncome * 0.25) // 25% estimate
        },

        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching caregiver analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
