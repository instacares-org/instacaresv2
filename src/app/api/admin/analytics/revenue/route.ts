import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');
    const timeRange = searchParams.get('timeRange') || '30d';
    const granularity = searchParams.get('granularity') || 'daily'; // daily, weekly, monthly

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    // Verify admin user
    const adminUser = await db.user.findFirst({
      where: { id: adminUserId, userType: 'ADMIN' }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get detailed revenue analytics
    const [
      totalRevenue,
      platformRevenue,
      caregiverPayouts,
      revenueByStatus,
      revenueByServiceType,
      topRevenueBookings,
      averageRevenueMetrics,
      paymentMethodStats,
      refundStats
    ] = await Promise.all([
      // Total Revenue
      db.booking.aggregate({
        _sum: { totalAmount: true, platformFee: true, subtotal: true },
        _count: { id: true },
        where: {
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),

      // Platform Revenue (Fees)
      db.booking.aggregate({
        _sum: { platformFee: true },
        where: {
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),

      // Caregiver Payouts (Total - Platform Fee)
      db.booking.aggregate({
        _sum: { subtotal: true },
        where: {
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),

      // Revenue by Booking Status
      db.booking.groupBy({
        by: ['status'],
        _sum: { totalAmount: true },
        _count: { status: true },
        where: { createdAt: { gte: startDate } }
      }),

      // Revenue by Service Type (from caregiver services)
      db.$queryRaw`
        SELECT 
          cs.serviceType,
          SUM(b.totalAmount) as totalRevenue,
          COUNT(b.id) as bookingCount,
          AVG(b.totalAmount) as avgBookingValue
        FROM bookings b
        JOIN caregivers c ON b.caregiverId = c.userId
        JOIN caregiver_services cs ON c.id = cs.caregiverId
        WHERE b.createdAt >= ${startDate}
          AND b.status IN ('COMPLETED', 'CONFIRMED')
        GROUP BY cs.serviceType
        ORDER BY totalRevenue DESC
      `,

      // Top Revenue Generating Bookings
      db.booking.findMany({
        take: 20,
        orderBy: { totalAmount: 'desc' },
        where: {
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        },
        include: {
          parent: { include: { profile: true } },
          caregiverUser: { include: { profile: true } },
          caregiverProfile: true
        }
      }),

      // Average Revenue Metrics
      db.booking.aggregate({
        _avg: { totalAmount: true, hourlyRate: true, totalHours: true },
        where: {
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),

      // Payment Method Statistics
      db.payment.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: { status: true },
        where: {
          createdAt: { gte: startDate }
        }
      }),

      // Refund Statistics
      db.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          status: 'REFUNDED',
          refundedAt: { gte: startDate }
        }
      })
    ]);

    // Get time series revenue data based on granularity
    let timeSeriesQuery;
    switch (granularity) {
      case 'weekly':
        timeSeriesQuery = db.$queryRaw`
          SELECT 
            strftime('%Y-%W', createdAt) as period,
            DATE(createdAt, 'weekday 0', '-6 days') as periodStart,
            SUM(totalAmount) as revenue,
            SUM(platformFee) as platformRevenue,
            COUNT(*) as bookingCount
          FROM bookings 
          WHERE createdAt >= ${startDate}
            AND status IN ('COMPLETED', 'CONFIRMED')
          GROUP BY strftime('%Y-%W', createdAt)
          ORDER BY periodStart ASC
        `;
        break;
      case 'monthly':
        timeSeriesQuery = db.$queryRaw`
          SELECT 
            strftime('%Y-%m', createdAt) as period,
            DATE(createdAt, 'start of month') as periodStart,
            SUM(totalAmount) as revenue,
            SUM(platformFee) as platformRevenue,
            COUNT(*) as bookingCount
          FROM bookings 
          WHERE createdAt >= ${startDate}
            AND status IN ('COMPLETED', 'CONFIRMED')
          GROUP BY strftime('%Y-%m', createdAt)
          ORDER BY periodStart ASC
        `;
        break;
      default: // daily
        timeSeriesQuery = db.$queryRaw`
          SELECT 
            DATE(createdAt) as period,
            DATE(createdAt) as periodStart,
            SUM(totalAmount) as revenue,
            SUM(platformFee) as platformRevenue,
            COUNT(*) as bookingCount
          FROM bookings 
          WHERE createdAt >= ${startDate}
            AND status IN ('COMPLETED', 'CONFIRMED')
          GROUP BY DATE(createdAt)
          ORDER BY periodStart ASC
        `;
    }

    const timeSeriesData = await timeSeriesQuery;

    // Calculate revenue distribution by hour ranges
    const hourlyRateDistribution = await db.booking.groupBy({
      by: ['hourlyRate'],
      _sum: { totalAmount: true },
      _count: { hourlyRate: true },
      where: {
        createdAt: { gte: startDate },
        status: { in: ['COMPLETED', 'CONFIRMED'] }
      },
      orderBy: { hourlyRate: 'asc' }
    });

    // Group hourly rates into ranges
    const rateRanges = [
      { min: 0, max: 15, label: '$0-15/hr' },
      { min: 15, max: 25, label: '$15-25/hr' },
      { min: 25, max: 35, label: '$25-35/hr' },
      { min: 35, max: 50, label: '$35-50/hr' },
      { min: 50, max: 100, label: '$50+/hr' }
    ];

    const revenueByRateRange = rateRanges.map(range => {
      const bookingsInRange = hourlyRateDistribution.filter(
        booking => booking.hourlyRate >= range.min && booking.hourlyRate < range.max
      );
      
      return {
        range: range.label,
        revenue: bookingsInRange.reduce((sum, booking) => sum + (booking._sum.totalAmount || 0), 0) / 100,
        bookingCount: bookingsInRange.reduce((sum, booking) => sum + booking._count.hourlyRate, 0)
      };
    });

    // Get top earning caregivers for this period
    const topEarningCaregivers = await db.$queryRaw`
      SELECT 
        c.id,
        up.firstName,
        up.lastName,
        SUM(b.totalAmount - b.platformFee) as earnings,
        COUNT(b.id) as bookingCount,
        AVG(b.totalAmount) as avgBookingValue,
        c.averageRating
      FROM bookings b
      JOIN caregivers c ON b.caregiverId = c.userId
      JOIN users u ON c.userId = u.id
      JOIN user_profiles up ON u.id = up.userId
      WHERE b.createdAt >= ${startDate}
        AND b.status IN ('COMPLETED', 'CONFIRMED')
      GROUP BY c.id, up.firstName, up.lastName, c.averageRating
      ORDER BY earnings DESC
      LIMIT 10
    `;

    const response = {
      timeRange,
      granularity,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),

      // Summary Metrics
      summary: {
        totalRevenue: (totalRevenue._sum.totalAmount || 0) / 100,
        platformRevenue: (platformRevenue._sum.platformFee || 0) / 100,
        caregiverPayouts: (caregiverPayouts._sum.subtotal || 0) / 100,
        totalBookings: totalRevenue._count.id,
        averageBookingValue: (averageRevenueMetrics._avg.totalAmount || 0) / 100,
        averageHourlyRate: averageRevenueMetrics._avg.hourlyRate || 0,
        averageHours: averageRevenueMetrics._avg.totalHours || 0,
        platformMargin: totalRevenue._sum.totalAmount ? 
          ((platformRevenue._sum.platformFee || 0) / (totalRevenue._sum.totalAmount || 1)) * 100 : 0
      },

      // Revenue by Status
      revenueByStatus: revenueByStatus.map(status => ({
        status: status.status,
        revenue: (status._sum.totalAmount || 0) / 100,
        bookingCount: status._count.status
      })),

      // Revenue by Service Type
      revenueByServiceType: (revenueByServiceType as any[]).map((service: any) => ({
        serviceType: service.serviceType,
        revenue: Number(service.totalRevenue) / 100,
        bookingCount: Number(service.bookingCount),
        averageBookingValue: Number(service.avgBookingValue) / 100
      })),

      // Revenue by Rate Range
      revenueByRateRange,

      // Top Revenue Bookings
      topBookings: topRevenueBookings.map(booking => ({
        id: booking.id,
        parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
        caregiverName: `${booking.caregiver.profile?.firstName} ${booking.caregiver.profile?.lastName}`,
        amount: booking.totalAmount / 100,
        hours: booking.totalHours,
        hourlyRate: booking.hourlyRate,
        createdAt: booking.createdAt,
        status: booking.status
      })),

      // Top Earning Caregivers
      topEarningCaregivers: (topEarningCaregivers as any[]).map((caregiver: any) => ({
        id: caregiver.id,
        name: `${caregiver.firstName} ${caregiver.lastName}`,
        earnings: Number(caregiver.earnings) / 100,
        bookingCount: Number(caregiver.bookingCount),
        averageBookingValue: Number(caregiver.avgBookingValue) / 100,
        averageRating: caregiver.averageRating || 0
      })),

      // Payment Statistics
      paymentStats: {
        byStatus: paymentMethodStats.map(stat => ({
          status: stat.status,
          amount: (stat._sum.amount || 0) / 100,
          count: stat._count.status
        })),
        refunds: {
          totalRefunded: (refundStats._sum.amount || 0) / 100,
          refundCount: refundStats._count.id
        }
      },

      // Time Series Data
      timeSeriesData: (timeSeriesData as any[]).map((point: any) => ({
        period: point.period,
        periodStart: point.periodStart,
        revenue: Number(point.revenue) / 100,
        platformRevenue: Number(point.platformRevenue) / 100,
        bookingCount: Number(point.bookingCount)
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}