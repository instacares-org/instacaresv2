import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find user in database with full details
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
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        profile: user.profile,
        caregiver: user.caregiver,
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user information' },
      { status: 500 }
    );
  }
}