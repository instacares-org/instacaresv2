import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTokenFromRequest } from '@/lib/jwt';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



// GET /api/admin/dashboard - Get admin dashboard data with real users
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user || tokenResult.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    // Check if database is available during build time
    let users;
    try {
      // Fetch real users from database
      users = await db.user.findMany({
        include: {
          profile: true,
          caregiver: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (dbError) {
      console.warn('Database not available during build, returning empty data:', dbError);
      // Return empty data during build time
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            totalUsers: 0,
            totalBookings: 0,
            totalCaregivers: 0,
            totalParents: 0,
            totalAdmins: 0,
            activeBookings: 0,
            completedBookings: 0,
            pendingApprovals: 0,
            activeUsers: 0,
            totalRevenue: 0,
            totalPlatformFees: 0,
            totalPayouts: 0,
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
        }
      });
    }

    // Fetch real bookings with error handling
    let bookings;
    let reviews;
    
    try {
      bookings = await db.booking.findMany({
        include: {
          parent: { include: { profile: true } },
          caregiverUser: { include: { profile: true } },
          caregiverProfile: true,
          payments: true,
          reviews: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 20
      });

      // Fetch real reviews
      reviews = await db.review.findMany({
        include: {
          reviewer: { include: { profile: true } },
          reviewee: { include: { profile: true } },
          booking: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });
    } catch (dbError) {
      console.warn('Database error fetching bookings/reviews:', dbError);
      bookings = [];
      reviews = [];
    }

    // Calculate stats
    const totalUsers = users.length;
    const totalCaregivers = users.filter(u => u.userType === 'CAREGIVER').length;
    const totalParents = users.filter(u => u.userType === 'PARENT').length;
    const totalAdmins = users.filter(u => u.userType === 'ADMIN').length;
    const pendingApprovals = users.filter(u => u.approvalStatus === 'PENDING').length;
    const activeUsers = users.filter(u => u.isActive).length;
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length;
    const activeBookings = bookings.filter(b => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length;
    
    // Calculate revenue
    const totalRevenue = bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPlatformFees = bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.platformFee, 0);

    // Transform users for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'No Name',
      email: user.email,
      type: user.userType.toLowerCase(),
      status: user.isActive ? 'active' : 'suspended',
      joinDate: user.createdAt.toISOString(),
      verified: user.emailVerified,
      approvalStatus: user.approvalStatus
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
      hasReview: booking.reviews?.length > 0 || false
    }));

    const dashboardData = {
      stats: {
        totalUsers,
        totalBookings: bookings.length,
        totalCaregivers,
        totalParents,
        totalAdmins,
        activeBookings,
        completedBookings,
        pendingApprovals,
        activeUsers,
        totalRevenue,
        totalPlatformFees,
        totalPayouts: totalRevenue - totalPlatformFees,
        pendingReviews: reviews.filter(r => !r.isApproved).length,
        newUsersThisWeek: users.filter(u => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return u.createdAt > weekAgo;
        }).length,
        supportTickets: 0 // TODO: Implement support tickets
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
      supportTickets: [] // TODO: Implement support tickets
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  } finally {
    // Safely disconnect from database
    try {
      await db.$disconnect();
    } catch (disconnectError) {
      console.warn('Database disconnect warning:', disconnectError);
    }
  }
}