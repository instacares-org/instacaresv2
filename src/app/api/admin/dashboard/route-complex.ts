import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

// GET /api/admin/dashboard - Get admin dashboard data (simplified version)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get basic stats first
    const [
      totalUsers,
      totalBookings,
      users,
      bookings
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      
      prisma.user.findMany({
        include: {
          profile: true,
          caregiver: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),

      prisma.booking.findMany({
        include: {
          parent: { include: { profile: true } },
          caregiver: { include: { profile: true } },
          payments: true,
          reviews: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);

    // Format the data for the dashboard
    const dashboardData = {
      stats: {
        totalUsers,
        totalBookings,
        activeUsers: users.filter(u => u.isActive).length,
        pendingApprovals: 0, // Simplified
        activeBookings: bookings.filter(b => 
          ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)
        ).length,
        totalCaregivers: users.filter(u => u.userType === 'CAREGIVER').length,
        totalParents: users.filter(u => u.userType === 'PARENT').length,
        totalAdmins: users.filter(u => u.userType === 'ADMIN').length,
        completedBookings: bookings.filter(b => b.status === 'COMPLETED').length,
        totalRevenue: 0, // Simplified for now
        totalPlatformFees: 0,
        totalPayouts: 0,
        pendingReviews: 0,
        newUsersThisWeek: 0,
        supportTickets: 0
      },
      users: users.map(user => ({
        id: user.id,
        name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'No Name',
        email: user.email,
        type: user.userType.toLowerCase(),
        status: user.isActive ? 'active' : 'inactive',
        joinDate: user.createdAt.toISOString(),
        verified: user.emailVerified,
        approvalStatus: user.approvalStatus,
        hourlyRate: user.caregiver?.hourlyRate,
        averageRating: user.caregiver?.averageRating
      })),
      bookings: bookings.map(booking => ({
        id: booking.id,
        parentName: `${booking.parent.profile?.firstName || ''} ${booking.parent.profile?.lastName || ''}`.trim(),
        caregiverName: `${booking.caregiver.profile?.firstName || ''} ${booking.caregiver.profile?.lastName || ''}`.trim(),
        date: booking.startTime.toISOString().split('T')[0],
        startTime: booking.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        endTime: booking.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        duration: booking.totalHours,
        childrenCount: booking.childrenCount,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        caregiverPayout: booking.totalAmount - booking.platformFee,
        status: booking.status.toLowerCase(),
        paymentStatus: booking.payments?.[0]?.status || 'pending',
        createdDate: booking.createdAt.toISOString(),
        hasReview: booking.reviews.length > 0
      })),
      payments: [], // Simplified for now
      pendingApprovals: [], // Simplified for now
      recentChats: [], // Simplified for now
      reviews: [], // Simplified for now
      supportTickets: [] // Placeholder
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
  }
}