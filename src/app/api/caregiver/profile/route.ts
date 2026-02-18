import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.userType !== 'CAREGIVER') {
      return NextResponse.json(
        { error: 'Only caregivers can access this endpoint' },
        { status: 403 }
      );
    }

    // Find or create the caregiver record
    let caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
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
        where: { userId: session.user.id }
      });

      caregiver = await prisma.caregiver.create({
        data: {
          userId: session.user.id,
          bio: 'Experienced and caring childcare provider',
          experienceYears: 5,
          hourlyRate: 25,
          dailyCapacity: 4,
          enableDynamicPricing: false
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
        maxChildren: caregiver.maxChildren,
        minAge: caregiver.minAge,
        maxAge: caregiver.maxAge,
        enableDynamicPricing: caregiver.enableDynamicPricing,
        isVerified: caregiver.isVerified,
        backgroundCheck: caregiver.backgroundCheck,
        totalBookings: caregiver.totalBookings,
        averageRating: caregiver.averageRating,
        stripeOnboarded: caregiver.stripeOnboarded,
        canReceivePayments: caregiver.canReceivePayments,
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