import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

// GET /api/admin/dashboard - Get admin dashboard data
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all the dashboard data in parallel
    const [
      users,
      bookings,
      payments,
      pendingApprovals,
      recentChats,
      reviews,
      stats
    ] = await Promise.all([
      // Get all users with profiles
      prisma.user.findMany({
        include: {
          profile: true,
          caregiver: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Limit to recent 100 users
      }),

      // Get all bookings with related data
      prisma.booking.findMany({
        include: {
          parent: { include: { profile: true } },
          caregiver: { include: { profile: true } },
          payments: true,
          reviews: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Limit to recent 100 bookings
      }),

      // Get all payments
      prisma.payment.findMany({
        include: {
          booking: {
            include: {
              parent: { include: { profile: true } },
              caregiver: { include: { profile: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),

      // Get pending caregiver approvals
      prisma.user.findMany({
        where: {
          userType: 'CAREGIVER',
          approvalStatus: 'PENDING'
        },
        include: {
          profile: true,
          caregiver: true
        }
      }),

      // Get recent chat activity
      prisma.chatRoom.findMany({
        include: {
          participants: {
            include: {
              user: {
                include: { profile: true }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),

      // Get reviews
      prisma.review.findMany({
        include: {
          reviewer: { include: { profile: true } },
          reviewee: { include: { profile: true } },
          booking: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),

      // Get statistics
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { userType: 'PARENT' } }),
        prisma.user.count({ where: { userType: 'CAREGIVER' } }),
        prisma.user.count({ where: { userType: 'ADMIN' } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: 'COMPLETED' } }),
        prisma.payment.aggregate({
          _sum: {
            amount: true,
            platformFee: true,
            caregiverPayout: true
          },
          where: { status: 'PAID' }
        }),
        prisma.review.count({ where: { isApproved: false } }),
        prisma.user.count({ 
          where: { 
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        })
      ]).then(([
        totalUsers,
        totalParents,
        totalCaregivers,
        totalAdmins,
        totalBookings,
        completedBookings,
        paymentSums,
        pendingReviews,
        newUsersThisWeek
      ]) => ({
        totalUsers,
        totalParents,
        totalCaregivers,
        totalAdmins,
        totalBookings,
        completedBookings,
        totalRevenue: paymentSums._sum.amount || 0,
        totalPlatformFees: paymentSums._sum.platformFee || 0,
        totalPayouts: paymentSums._sum.caregiverPayout || 0,
        pendingReviews,
        newUsersThisWeek
      }))
    ]);

    // Format the data for the dashboard
    const dashboardData = {
      stats: {
        ...stats,
        activeUsers: users.filter(u => u.isActive).length,
        pendingApprovals: pendingApprovals.length,
        activeBookings: bookings.filter(b => 
          ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)
        ).length
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
      payments: payments.map(payment => ({
        id: payment.id,
        bookingId: payment.bookingId,
        parentName: `${payment.booking.parent.profile?.firstName || ''} ${payment.booking.parent.profile?.lastName || ''}`.trim(),
        caregiverName: `${payment.booking.caregiver.profile?.firstName || ''} ${payment.booking.caregiver.profile?.lastName || ''}`.trim(),
        amount: payment.amount,
        platformFee: payment.platformFee,
        caregiverPayout: payment.caregiverPayout,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt?.toISOString(),
        createdAt: payment.createdAt.toISOString()
      })),
      pendingApprovals: pendingApprovals.map(user => ({
        id: user.id,
        type: 'verification',
        caregiverName: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        submittedDate: user.createdAt.toISOString(),
        description: 'Background check and profile verification',
        email: user.email,
        hourlyRate: user.caregiver?.hourlyRate,
        experienceYears: user.caregiver?.experienceYears,
        bio: user.caregiver?.bio
      })),
      recentChats: recentChats.map(room => ({
        roomId: room.id,
        participants: room.participants.map(p => ({
          userId: p.userId,
          name: `${p.user.profile?.firstName || ''} ${p.user.profile?.lastName || ''}`.trim(),
          userType: p.user.userType
        })),
        lastMessage: room.messages[0] ? {
          content: room.messages[0].content,
          sentAt: room.messages[0].createdAt.toISOString(),
          senderName: room.participants.find(p => p.userId === room.messages[0].senderId)?.user.profile?.firstName || 'Unknown'
        } : null,
        updatedAt: room.updatedAt.toISOString()
      })),
      reviews: reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isApproved: review.isApproved,
        reviewerName: `${review.reviewer.profile?.firstName || ''} ${review.reviewer.profile?.lastName || ''}`.trim(),
        revieweeName: `${review.reviewee.profile?.firstName || ''} ${review.reviewee.profile?.lastName || ''}`.trim(),
        createdAt: review.createdAt.toISOString(),
        moderatedAt: review.moderatedAt?.toISOString()
      })),
      supportTickets: [] // Placeholder - no support ticket system yet
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