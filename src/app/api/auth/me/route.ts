import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return ApiErrors.unauthorized('Not authenticated');
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
      return ApiErrors.notFound('User not found');
    }

    return apiSuccess({
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
    return ApiErrors.internal('Failed to get user information');
  }
}