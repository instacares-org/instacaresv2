import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (tokenResult.user.userType !== 'CAREGIVER') {
      return NextResponse.json(
        { error: 'Only caregivers can access this endpoint' },
        { status: 403 }
      );
    }

    // Find or create the caregiver record
    let caregiver = await prisma.caregiver.findUnique({
      where: { userId: tokenResult.user.userId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!caregiver) {
      // Create caregiver record if it doesn't exist
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: tokenResult.user.userId }
      });

      caregiver = await prisma.caregiver.create({
        data: {
          userId: tokenResult.user.userId,
          bio: 'Experienced and caring childcare provider',
          experienceYears: 5,
          hourlyRate: 25,
          dailyCapacity: 4,
          enableInstantBooking: true,
          enableDynamicPricing: false,
          responseTimeHours: 1,
          acceptsLastMinute: true,
          cancellationPolicyHours: 24
        },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      caregiver: {
        id: caregiver.id,
        userId: caregiver.userId,
        bio: caregiver.bio,
        experienceYears: caregiver.experienceYears,
        hourlyRate: caregiver.hourlyRate,
        dailyCapacity: caregiver.dailyCapacity,
        enableInstantBooking: caregiver.enableInstantBooking,
        enableDynamicPricing: caregiver.enableDynamicPricing,
        responseTimeHours: caregiver.responseTimeHours,
        acceptsLastMinute: caregiver.acceptsLastMinute,
        cancellationPolicyHours: caregiver.cancellationPolicyHours,
        profile: caregiver.user?.profile
      }
    });

  } catch (error) {
    console.error('Error fetching caregiver profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch caregiver profile'
    }, { status: 500 });
  }
}