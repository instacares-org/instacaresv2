import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/dashboard - Get admin dashboard data with real users
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await withAuth(request, 'ADMIN');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    // Check if database is available during build time
    try {
      await db.$queryRaw`SELECT 1`;
    } catch (dbError) {
      console.warn('Database not available during build, returning empty data:', dbError);
      return apiSuccess({
        stats: {
          totalUsers: 0,
          totalBookings: 0,
          totalCaregivers: 0,
          totalBabysitters: 0,
          totalParents: 0,
          totalAdmins: 0,
          activeBookings: 0,
          completedBookings: 0,
          pendingApprovals: 0,
          activeUsers: 0,
          totalRevenue: 0,
          totalPlatformFees: 0,
          totalPayouts: 0,
          pendingPayouts: 0,
          completedRevenue: 0,
          completedPlatformFees: 0,
          pendingReviews: 0,
          newUsersThisWeek: 0,
          supportTickets: 0
        },
        users: [],
        bookings: [],
        reviews: [],
        pendingApprovals: [],
        recentChats: [],
        supportTickets: []
      });
    }

    // Date threshold for "new users this week"
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Run all independent count/aggregate queries and list fetches in parallel
    const [
      // User stats (count queries)
      totalUsers,
      totalCaregivers,
      totalBabysitters,
      totalParents,
      totalAdmins,
      pendingApprovals,
      activeUsers,
      newUsersThisWeek,
      // Booking stats (count queries)
      totalBookings,
      completedBookings,
      activeBookings,
      // Revenue aggregations (completed bookings)
      completedRevenueAgg,
      // Revenue aggregations (all bookings with PAID payments)
      paidBookingRevenueAgg,
      // Pending payouts (CONFIRMED/IN_PROGRESS with PAID payments)
      pendingPayoutAgg,
      // Review stats
      pendingReviews,
      // Support ticket stats
      openSupportTickets,
      // List data for display (with limits)
      users,
      bookings,
      reviews,
      supportTickets,
    ] = await Promise.all([
      // User count queries
      db.user.count(),
      db.user.count({ where: { userType: 'CAREGIVER' } }),
      db.user.count({ where: { userType: 'BABYSITTER' } }),
      db.user.count({ where: { userType: 'PARENT' } }),
      db.user.count({ where: { userType: 'ADMIN' } }),
      db.user.count({ where: { approvalStatus: 'PENDING' } }),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { createdAt: { gt: weekAgo } } }),
      // Booking count queries
      db.booking.count(),
      db.booking.count({ where: { status: 'COMPLETED' } }),
      db.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } } }),
      // Revenue from COMPLETED bookings
      db.booking.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true, platformFee: true },
      }),
      // Revenue from ALL bookings that have at least one PAID payment
      db.booking.aggregate({
        where: { payments: { some: { status: 'PAID' } } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      // Pending payouts: CONFIRMED/IN_PROGRESS bookings with PAID payments
      db.booking.aggregate({
        where: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          payments: { some: { status: 'PAID' } },
        },
        _sum: { totalAmount: true, platformFee: true },
      }),
      // Pending reviews count
      db.review.count({ where: { isApproved: false } }),
      // Open/in-progress support tickets count
      db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      // User list for display (limited to 50 most recent)
      db.user.findMany({
        include: {
          profile: true,
          caregiver: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Recent bookings for display
      db.booking.findMany({
        include: {
          parent: { include: { profile: true } },
          caregiverUser: { include: { profile: true } },
          caregiverProfile: true,
          payments: true,
          reviews: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Recent reviews for display
      db.review.findMany({
        include: {
          reviewer: { include: { profile: true } },
          reviewee: { include: { profile: true } },
          booking: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Recent support tickets for display
      db.supportTicket.findMany({
        include: {
          user: { include: { profile: true } },
          responses: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Extract aggregated revenue values
    const completedRevenue = completedRevenueAgg._sum.totalAmount ?? 0;
    const completedPlatformFees = completedRevenueAgg._sum.platformFee ?? 0;
    const totalRevenue = paidBookingRevenueAgg._sum.totalAmount ?? 0;
    const totalPlatformFees = paidBookingRevenueAgg._sum.platformFee ?? 0;
    const pendingPayoutTotal = pendingPayoutAgg._sum.totalAmount ?? 0;
    const pendingPayoutFees = pendingPayoutAgg._sum.platformFee ?? 0;
    const pendingPayouts = pendingPayoutTotal - pendingPayoutFees;

    // Transform users for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'No Name',
      email: user.email,
      type: user.userType.toLowerCase(),
      status: user.isActive ? 'active' : 'suspended',
      joinDate: user.createdAt.toISOString(),
      verified: user.emailVerified,
      approvalStatus: user.approvalStatus,
      lastLoginAt: user.lastLogin?.toISOString(),
      profile: user.profile,
      caregiver: user.caregiver
    }));

    // Transform bookings for frontend
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      parentName: booking.parent.profile ?
        `${booking.parent.profile.firstName} ${booking.parent.profile.lastName}` : 'Unknown Parent',
      caregiverName: booking.caregiverUser.profile ?
        `${booking.caregiverUser.profile.firstName} ${booking.caregiverUser.profile.lastName}` : 'Unknown Caregiver',
      date: booking.startTime.toISOString().split('T')[0],
      startTime: booking.startTime.toTimeString().substring(0, 5),
      endTime: booking.endTime.toTimeString().substring(0, 5),
      duration: booking.totalHours,
      childrenCount: booking.childrenCount,
      amount: booking.totalAmount,
      platformFee: booking.platformFee,
      caregiverPayout: booking.totalAmount - booking.platformFee,
      status: booking.status.toLowerCase(),
      paymentStatus: booking.payments.length > 0 ? booking.payments[0].status.toLowerCase() : 'pending',
      createdDate: booking.createdAt.toISOString(),
      hasReview: booking.reviews !== null
    }));

    const dashboardData = {
      stats: {
        totalUsers,
        totalBookings,
        totalCaregivers,
        totalBabysitters,
        totalParents,
        totalAdmins,
        activeBookings,
        completedBookings,
        pendingApprovals,
        activeUsers,
        totalRevenue,
        totalPlatformFees,
        totalPayouts: totalRevenue - totalPlatformFees,
        pendingPayouts,
        completedRevenue,
        completedPlatformFees,
        pendingReviews,
        newUsersThisWeek,
        supportTickets: openSupportTickets
      },
      users: transformedUsers,
      bookings: transformedBookings,
      reviews: reviews.map(r => ({
        id: r.id,
        reviewer: r.reviewer.profile ?
          `${r.reviewer.profile.firstName} ${r.reviewer.profile.lastName}` : 'Unknown',
        reviewee: r.reviewee.profile ?
          `${r.reviewee.profile.firstName} ${r.reviewee.profile.lastName}` : 'Unknown',
        rating: r.rating,
        comment: r.comment,
        isApproved: r.isApproved,
        createdAt: r.createdAt.toISOString()
      })),
      pendingApprovals: [], // TODO: Implement pending approvals
      recentChats: [], // TODO: Implement recent chats
      supportTickets: supportTickets.map(ticket => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        userName: ticket.user.profile ?
          `${ticket.user.profile.firstName} ${ticket.user.profile.lastName}` : ticket.user.email,
        userEmail: ticket.user.email,
        userType: ticket.userType,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString(),
        responseCount: ticket.responses?.length || 0
      }))
    };

    return apiSuccess(dashboardData);

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return ApiErrors.internal('Failed to fetch dashboard data');
  }
}
