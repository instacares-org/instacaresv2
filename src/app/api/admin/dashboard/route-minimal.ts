import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

// GET /api/admin/dashboard - Get admin dashboard data (minimal working version)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get just basic counts - no complex joins
    const [
      totalUsers,
      totalBookings,
      totalCaregivers,
      totalParents,
      activeBookings
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.user.count({ where: { userType: 'CAREGIVER' } }),
      prisma.user.count({ where: { userType: 'PARENT' } }),
      prisma.booking.count({ 
        where: { 
          status: { 
            in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] 
          } 
        } 
      })
    ]);

    // Get basic user list without complex includes
    const users = await prisma.user.findMany({
      include: {
        profile: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Get basic booking list without complex includes  
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Format minimal dashboard data
    const dashboardData = {
      stats: {
        totalUsers,
        totalBookings,
        totalCaregivers,
        totalParents,
        totalAdmins: 1, // Simplified
        activeBookings,
        completedBookings: totalBookings - activeBookings,
        pendingApprovals: 0,
        activeUsers: users.filter(u => u.isActive).length,
        totalRevenue: 0,
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
        approvalStatus: user.approvalStatus
      })),
      bookings: bookings.map(booking => ({
        id: booking.id,
        parentName: 'Parent User', // Simplified
        caregiverName: 'Caregiver User', // Simplified
        date: booking.startTime.toISOString().split('T')[0],
        startTime: booking.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        endTime: booking.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        duration: booking.totalHours,
        childrenCount: booking.childrenCount,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        caregiverPayout: booking.totalAmount - booking.platformFee,
        status: booking.status.toLowerCase(),
        paymentStatus: 'pending', // Simplified
        createdDate: booking.createdAt.toISOString(),
        hasReview: false // Simplified
      })),
      payments: [], // Empty for now
      pendingApprovals: [], // Empty for now
      recentChats: [], // Empty for now
      reviews: [], // Empty for now
      supportTickets: [] // Empty for now
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