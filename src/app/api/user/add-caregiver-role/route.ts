import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const addCaregiverRoleSchema = z.object({
  caregiverData: z.object({
    bio: z.string().max(2000, 'Bio too long').optional(),
    hourlyRate: z.number().min(0, 'Hourly rate must be non-negative').max(1000, 'Hourly rate too high').optional(),
    experienceYears: z.number().int('Experience years must be a whole number').min(0, 'Experience years must be non-negative').max(100, 'Experience years too high').optional(),
    specialties: z.array(z.string().max(100, 'Specialty too long')).max(20, 'Too many specialties').optional(),
  }).optional(),
});

/**
 * Geocode an address using Mapbox API
 * This is a fallback when coordinates are not provided
 */
async function geocodeAddress(address: {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}): Promise<{ latitude: number; longitude: number } | null> {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.warn('[add-caregiver-role] Mapbox token not configured - cannot geocode address');
    return null;
  }

  try {
    const searchQuery = `${address.streetAddress}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
    const encodedQuery = encodeURIComponent(searchQuery);

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=1&types=address`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      console.error('[add-caregiver-role] Mapbox geocoding failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log(`[add-caregiver-role] Geocoded: ${searchQuery} -> (${latitude}, ${longitude})`);
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.error('[add-caregiver-role] Geocode error:', error);
    return null;
  }
}

/**
 * POST /api/user/add-caregiver-role
 * Adds caregiver role to an existing parent user, creating the necessary caregiver profile.
 * This enables dual-role functionality where a user can be both a parent and caregiver.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.PROFILE_UPDATE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const body = await request.json();
    const parsed = addCaregiverRoleSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { caregiverData } = parsed.data;

    // Get current user with profile
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isParent: true,
        isCaregiver: true,
        caregiver: true,
        profile: {
          select: {
            streetAddress: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    // Check if user already has caregiver role
    if (user.isCaregiver) {
      return ApiErrors.badRequest('You already have a caregiver role.');
    }

    // Check if user profile has coordinates - if not, try to geocode
    if (user.profile && (!user.profile.latitude || !user.profile.longitude)) {
      console.log(`[add-caregiver-role] User ${userId} missing coordinates, attempting geocode...`);

      if (user.profile.streetAddress && user.profile.city && user.profile.state && user.profile.zipCode) {
        const geocoded = await geocodeAddress({
          streetAddress: user.profile.streetAddress,
          city: user.profile.city,
          state: user.profile.state,
          zipCode: user.profile.zipCode,
          country: user.profile.country || 'CA',
        });

        if (geocoded) {
          await db.userProfile.update({
            where: { userId },
            data: {
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
            },
          });
          console.log(`[add-caregiver-role] Updated coordinates for user ${userId}: (${geocoded.latitude}, ${geocoded.longitude})`);
        } else {
          console.warn(`[add-caregiver-role] Could not geocode address for user ${userId}`);
        }
      } else {
        console.warn(`[add-caregiver-role] User ${userId} has incomplete address - cannot geocode`);
      }
    }

    // Update user to have caregiver role and create caregiver profile
    const updatedUser = await db.$transaction(async (tx) => {
      // Create caregiver profile if it doesn't exist
      if (!user.caregiver) {
        await tx.caregiver.create({
          data: {
            userId: userId,
            bio: caregiverData?.bio || '',
            hourlyRate: caregiverData?.hourlyRate || 25,
            experienceYears: caregiverData?.experienceYears || 0,
            isAvailable: false, // Start as unavailable until profile is complete
            specialties: caregiverData?.specialties || [],
          },
        });
      }

      // Update user with caregiver role while preserving parent role
      return tx.user.update({
        where: { id: userId },
        data: {
          isCaregiver: true,
          // Ensure isParent is true since this flow is for parents becoming caregivers
          isParent: true,
          // Set active role to caregiver since they're adding this role
          activeRole: 'CAREGIVER',
          userType: 'CAREGIVER',
          // Set approval status to PENDING for caregiver review
          approvalStatus: 'PENDING',
        },
        select: {
          id: true,
          email: true,
          isParent: true,
          isCaregiver: true,
          activeRole: true,
          userType: true,
          approvalStatus: true,
        },
      });
    });

    console.log(`[add-caregiver-role] User ${userId} added caregiver role`);

    return apiSuccess({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isParent: updatedUser.isParent,
        isCaregiver: updatedUser.isCaregiver,
        activeRole: updatedUser.activeRole,
        approvalStatus: updatedUser.approvalStatus,
      },
    }, 'Successfully added caregiver role. Your caregiver profile is pending approval.');

  } catch (error) {
    console.error('Error adding caregiver role:', error);
    return ApiErrors.internal('Failed to add caregiver role');
  }
}
