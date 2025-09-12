import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/database';

// Simple NextAuth session options for this endpoint
const authOptions = {
  providers: [], // We don't need providers here, just session reading
  secret: process.env.NEXTAUTH_SECRET,
};

export async function GET(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);
    
    console.log('Session check:', {
      hasSession: !!session,
      userEmail: session?.user?.email,
      sessionData: session
    });
    
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
      }
    });

  } catch (error) {
    console.error('Session endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check session',
      authenticated: false
    }, { status: 500 });
  }
}