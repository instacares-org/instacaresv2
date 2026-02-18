import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/database';
import { authOptions } from '../../auth/[...nextauth]/options';

/**
 * GET /api/user/session-info
 * Returns detailed user information from database based on current session.
 * This is separate from NextAuth's /api/auth/session to avoid conflicts.
 */
export async function GET(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'No active session',
        authenticated: false
      }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        profile: true,
        caregiver: {
          select: {
            id: true,
            hourlyRate: true,
            averageRating: true,
            isAvailable: true,
            bio: true,
            experienceYears: true,
            stripeAccountId: true,
          }
        },
        _count: {
          select: {
            receivedReviews: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found in database',
        authenticated: false
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        // Dual role support
        isParent: user.isParent,
        isCaregiver: user.isCaregiver,
        activeRole: user.activeRole,
        profile: user.profile ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          phone: user.profile.phone,
          avatar: user.profile.avatar,
          dateOfBirth: user.profile.dateOfBirth,
          streetAddress: user.profile.streetAddress,
          city: user.profile.city,
          province: user.profile.state,
          postalCode: user.profile.zipCode,
          country: user.profile.country,
          emergencyName: user.profile.emergencyName,
          emergencyPhone: user.profile.emergencyPhone,
          emergencyRelation: user.profile.emergencyRelation,
        } : null,
        caregiver: user.caregiver || null,
        _count: user._count || null,
      }
    });

  } catch (error) {
    console.error('Session info endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check session',
      authenticated: false
    }, { status: 500 });
  }
}
