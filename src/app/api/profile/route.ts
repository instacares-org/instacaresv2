import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * GET /api/profile
 * Fetches the current user's profile data directly from the database.
 * This ensures fresh data is returned, bypassing any session caching.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch fresh profile data from database
    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        streetAddress: true,
        apartment: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        latitude: true,
        longitude: true,
        timezone: true,
        emergencyName: true,
        emergencyPhone: true,
        emergencyRelation: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({
        error: 'Profile not found',
        profile: null
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
