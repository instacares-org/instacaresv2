import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/adminAuth';



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d'; // 7d, 30d, 90d, 1y

    // Verify admin authentication using the proper admin auth system
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const adminUser = authResult.user!;

    // Calculate date range
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

    // Get comprehensive analytics data in parallel
    const [
      // User Statistics
      totalUsers,
      totalParents,
      totalCaregivers,
      activeUsers,
      newUsersThisPeriod,
      
      // Booking Statistics
      totalBookings,
      bookingsThisPeriod,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      
      // Revenue Statistics
      totalRevenue,
      revenueThisPeriod,
      platformFees,
      averageBookingValue,
      
      // Geographic Data
      topCities,
      
      // Caregiver Performance
      topCaregivers,
      averageRatings,
      verificationStats,
      
      // Chat Activity
      totalChatRooms,
      activeChatRooms,
      totalMessages,
      
      // Recent Activity
      recentBookings,
      recentReviews,
      
      // Time Series Data
      dailyBookings,
      dailyRevenue,
      dailyNewUsers
    ] = await Promise.all([
      // User Statistics
      db.user.count(),
      db.user.count({ where: { userType: 'PARENT' } }),
      db.user.count({ where: { userType: 'CAREGIVER' } }),
      db.user.count({ 
        where: { 
          lastLogin: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),
      db.user.count({ 
        where: { 
          createdAt: { gte: startDate },
          userType: { in: ['PARENT', 'CAREGIVER'] }
        }
      }),
      
      // Booking Statistics
      db.booking.count(),
      db.booking.count({ where: { createdAt: { gte: startDate } } }),
      db.booking.count({ where: { status: 'COMPLETED' } }),
      db.booking.count({ where: { status: 'PENDING' } }),
      db.booking.count({ where: { status: 'CANCELLED' } }),
      
      // Revenue Statistics
      db.booking.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: ['COMPLETED', 'CONFIRMED'] } }
      }),
      db.booking.aggregate({
        _sum: { totalAmount: true },
        where: { 
          createdAt: { gte: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),
      db.booking.aggregate({
        _sum: { platformFee: true },
        where: { status: { in: ['COMPLETED', 'CONFIRMED'] } }
      }),
      db.booking.aggregate({
        _avg: { totalAmount: true },
        where: { status: { in: ['COMPLETED', 'CONFIRMED'] } }
      }),
      
      // Geographic Data
      db.userProfile.groupBy({
        by: ['city'],
        _count: { city: true },
        where: { 
          city: { not: null },
          user: { userType: { in: ['PARENT', 'CAREGIVER'] } }
        },
        orderBy: { _count: { city: 'desc' } },
        take: 10
      }),
      
      // Top Caregivers
      db.caregiver.findMany({
        take: 10,
        orderBy: { totalEarnings: 'desc' },
        include: {
          user: {
            include: { profile: true }
          }
        }
      }),
      
      // Average Ratings
      db.review.aggregate({
        _avg: { rating: true },
        _count: { rating: true }
      }),
      
      // Verification Statistics
      db.caregiver.groupBy({
        by: ['isVerified'],
        _count: { isVerified: true }
      }),
      
      // Chat Statistics
      db.chatRoom.count(),
      db.chatRoom.count({ where: { isActive: true } }),
      db.message.count(),
      
      // Recent Activity
      db.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: { include: { profile: true } },
          caregiver: { include: { profile: true } }
        }
      }),
      
      db.review.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { include: { profile: true } },
          reviewee: { include: { profile: true } },
          booking: true
        }
      }),
      
      // Time Series Data - Daily Bookings
      db.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as count
        FROM bookings 
        WHERE createdAt >= ${startDate}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      
      // Time Series Data - Daily Revenue
      db.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          SUM(totalAmount) as revenue
        FROM bookings 
        WHERE createdAt >= ${startDate} 
          AND status IN ('COMPLETED', 'CONFIRMED')
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      
      // Time Series Data - Daily New Users
      db.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as count
        FROM users 
        WHERE createdAt >= ${startDate}
          AND userType IN ('PARENT', 'CAREGIVER')
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `
    ]);

    // Calculate growth rates
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    
    const [previousBookings, previousRevenue, previousUsers] = await Promise.all([
      db.booking.count({ 
        where: { 
          createdAt: { gte: previousPeriodStart, lt: startDate }
        }
      }),
      db.booking.aggregate({
        _sum: { totalAmount: true },
        where: { 
          createdAt: { gte: previousPeriodStart, lt: startDate },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        }
      }),
      db.user.count({ 
        where: { 
          createdAt: { gte: previousPeriodStart, lt: startDate },
          userType: { in: ['PARENT', 'CAREGIVER'] }
        }
      })
    ]);

    // Calculate growth percentages
    const bookingGrowth = previousBookings > 0 
      ? ((bookingsThisPeriod - previousBookings) / previousBookings) * 100 
      : 0;
    
    const revenueGrowth = (previousRevenue._sum.totalAmount || 0) > 0 
      ? (((revenueThisPeriod._sum.totalAmount || 0) - (previousRevenue._sum.totalAmount || 0)) / (previousRevenue._sum.totalAmount || 0)) * 100 
      : 0;
    
    const userGrowth = previousUsers > 0 
      ? ((newUsersThisPeriod - previousUsers) / previousUsers) * 100 
      : 0;

    // Calculate business health metrics
    const bookingCompletionRate = totalBookings > 0 
      ? (completedBookings / totalBookings) * 100 
      : 0;
    
    const userEngagementRate = totalUsers > 0 
      ? (activeUsers / totalUsers) * 100 
      : 0;

    const response = {
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      
      // Key Metrics
      keyMetrics: {
        totalRevenue: {
          value: (totalRevenue._sum.totalAmount || 0) / 100, // Convert from cents
          growth: revenueGrowth,
          periodValue: (revenueThisPeriod._sum.totalAmount || 0) / 100
        },
        totalBookings: {
          value: totalBookings,
          growth: bookingGrowth,
          periodValue: bookingsThisPeriod
        },
        totalUsers: {
          value: totalUsers,
          growth: userGrowth,
          periodValue: newUsersThisPeriod
        },
        averageBookingValue: {
          value: (averageBookingValue._avg.totalAmount || 0) / 100,
          growth: 0 // Would need historical data for this
        }
      },
      
      // User Analytics
      userAnalytics: {
        totalUsers,
        totalParents,
        totalCaregivers,
        activeUsers,
        newUsersThisPeriod,
        userEngagementRate: parseFloat(userEngagementRate.toFixed(2))
      },
      
      // Booking Analytics
      bookingAnalytics: {
        totalBookings,
        bookingsThisPeriod,
        completedBookings,
        pendingBookings,
        cancelledBookings,
        completionRate: parseFloat(bookingCompletionRate.toFixed(2)),
        statusDistribution: {
          completed: completedBookings,
          pending: pendingBookings,
          cancelled: cancelledBookings
        }
      },
      
      // Revenue Analytics
      revenueAnalytics: {
        totalRevenue: (totalRevenue._sum.totalAmount || 0) / 100,
        revenueThisPeriod: (revenueThisPeriod._sum.totalAmount || 0) / 100,
        platformFees: (platformFees._sum.platformFee || 0) / 100,
        averageBookingValue: (averageBookingValue._avg.totalAmount || 0) / 100,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2))
      },
      
      // Geographic Analytics
      geographicAnalytics: {
        topCities: topCities.map(city => ({
          city: city.city,
          userCount: city._count.city
        }))
      },
      
      // Caregiver Analytics
      caregiverAnalytics: {
        totalCaregivers,
        averageRating: parseFloat((averageRatings._avg.rating || 0).toFixed(2)),
        totalReviews: averageRatings._count.rating,
        verificationStats: verificationStats.reduce((acc, stat) => {
          acc[stat.isVerified ? 'verified' : 'unverified'] = stat._count.isVerified;
          return acc;
        }, { verified: 0, unverified: 0 }),
        topEarners: topCaregivers.map(caregiver => ({
          id: caregiver.id,
          name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
          totalEarnings: caregiver.totalEarnings / 100,
          totalBookings: caregiver.totalBookings,
          averageRating: caregiver.averageRating || 0
        }))
      },
      
      // Chat Analytics
      chatAnalytics: {
        totalChatRooms,
        activeChatRooms,
        totalMessages,
        chatEngagementRate: totalChatRooms > 0 ? (activeChatRooms / totalChatRooms) * 100 : 0
      },
      
      // Recent Activity
      recentActivity: {
        bookings: recentBookings.map(booking => ({
          id: booking.id,
          parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
          caregiverName: `${booking.caregiver.profile?.firstName} ${booking.caregiver.profile?.lastName}`,
          amount: booking.totalAmount / 100,
          status: booking.status,
          createdAt: booking.createdAt
        })),
        reviews: recentReviews.map(review => ({
          id: review.id,
          rating: review.rating,
          reviewerName: `${review.reviewer.profile?.firstName} ${review.reviewer.profile?.lastName}`,
          revieweeName: `${review.reviewee.profile?.firstName} ${review.reviewee.profile?.lastName}`,
          comment: review.comment,
          createdAt: review.createdAt
        }))
      },
      
      // Time Series Data
      timeSeriesData: {
        dailyBookings: dailyBookings.map((item: any) => ({
          date: item.date,
          count: Number(item.count)
        })),
        dailyRevenue: dailyRevenue.map((item: any) => ({
          date: item.date,
          revenue: Number(item.revenue) / 100 // Convert from cents and BigInt to number
        })),
        dailyNewUsers: dailyNewUsers.map((item: any) => ({
          date: item.date,
          count: Number(item.count)
        }))
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics overview' },
      { status: 500 }
    );
  }
}