import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * Geocode an address using Mapbox API
 * This is a fallback when coordinates are not provided from the frontend
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
    console.warn('Mapbox token not configured - cannot geocode address');
    return null;
  }

  try {
    // Build the search query from address components
    const searchQuery = `${address.streetAddress}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
    const encodedQuery = encodeURIComponent(searchQuery);

    // Use Mapbox Geocoding API
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=1&types=address`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      console.error('Mapbox geocoding failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log(`[GEOCODE] Successfully geocoded address -> (${latitude}, ${longitude})`);
      return { latitude, longitude };
    }

    console.warn(`[GEOCODE] No results found for address`);
    return null;
  } catch (error) {
    console.error('[GEOCODE] Error geocoding address:', error);
    return null;
  }
}

// Questionnaire schema for caregivers
const questionnaireSchema = z.object({
  hasInsurance: z.boolean().nullable(),
  hasFireAlarmCO: z.boolean().nullable(),
  hasPets: z.boolean().nullable(),
  petsDescription: z.string().optional(),
  hasBackgroundCheck: z.boolean().nullable(),
  hasFirstAidCPR: z.boolean().nullable(),
  hasOtherCertifications: z.boolean().nullable().optional(),
  otherCertificationsDescription: z.string().optional(),
});

// Validation schema for profile completion
const profileCompleteSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  dateOfBirth: z.string().refine((val) => {
    const date = new Date(val);
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age >= 18;
  }, 'You must be at least 18 years old'),
  streetAddress: z.string().min(1, 'Street address is required'),
  apartment: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'Province/State is required'),
  zipCode: z.string().min(1, 'Postal/Zip code is required'),
  country: z.string().default('CA'),
  // Coordinates from address autocomplete
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  // Optional caregiver-specific fields
  userType: z.enum(['parent', 'caregiver', 'babysitter']).optional(),
  questionnaireData: questionnaireSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.PROFILE_UPDATE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Auth via JWT token (reliable in Next.js 15 App Router)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token?.email) {
      return ApiErrors.unauthorized('Unauthorized. Please sign in.');
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = profileCompleteSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      return ApiErrors.badRequest('Validation failed', errors.fieldErrors);
    }

    const data = validationResult.data;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      include: { profile: true }
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    // Update or create profile
    const dateOfBirth = new Date(data.dateOfBirth);

    // Determine coordinates - use provided values or geocode as fallback
    let latitude = data.latitude || null;
    let longitude = data.longitude || null;

    // If coordinates are missing, attempt to geocode the address
    if (!latitude || !longitude) {
      console.log(`[PROFILE] Coordinates missing for user ${user.id}, attempting geocode...`);
      const geocoded = await geocodeAddress({
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
      });

      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        console.log(`[PROFILE] Geocoded coordinates for user ${user.id}: (${latitude}, ${longitude})`);
      } else {
        console.warn(`[PROFILE] Could not geocode address for user ${user.id} - caregiver may not appear in search`);
      }
    } else {
      console.log(`[PROFILE] Coordinates provided for user ${user.id}: (${latitude}, ${longitude})`);
    }

    if (user.profile) {
      // Update existing profile
      await prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          dateOfBirth,
          streetAddress: data.streetAddress,
          apartment: data.apartment || null,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          country: data.country,
          latitude,
          longitude,
        }
      });
    } else {
      // Create new profile
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          dateOfBirth,
          streetAddress: data.streetAddress,
          apartment: data.apartment || null,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          country: data.country,
          latitude,
          longitude,
        }
      });
    }

    // Update user name from profile
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: `${data.firstName} ${data.lastName}`
      }
    });

    // Handle caregiver-specific data if this is a caregiver OAuth completion
    if (data.userType === 'caregiver' && data.questionnaireData) {
      // Update user type to CAREGIVER if not already
      if (user.userType !== 'CAREGIVER') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            userType: 'CAREGIVER',
            approvalStatus: 'PENDING', // Caregivers need admin approval
            isCaregiver: true,
            activeRole: 'CAREGIVER',
          }
        });
      }

      // Check if caregiver profile exists
      let caregiver = await prisma.caregiver.findUnique({
        where: { userId: user.id }
      });

      const questionnaire = data.questionnaireData;

      if (!caregiver) {
        // Create caregiver profile
        caregiver = await prisma.caregiver.create({
          data: {
            userId: user.id,
            hourlyRate: 0, // Will be set later by caregiver
            experienceYears: 0,
            backgroundCheck: questionnaire.hasBackgroundCheck === true,
            // Store additional questionnaire data in JSON fields
            specialties: questionnaire.hasOtherCertifications
              ? [questionnaire.otherCertificationsDescription].filter(Boolean) as string[]
              : [],
          }
        });

        // Create caregiver verification record with questionnaire answers
        await prisma.caregiverVerification.create({
          data: {
            caregiverId: caregiver.id,
            idVerificationStatus: 'PENDING' as VerificationStatus,
            backgroundCheckStatus: (questionnaire.hasBackgroundCheck ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
            insuranceStatus: (questionnaire.hasInsurance ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
            referencesStatus: 'PENDING' as VerificationStatus,
            // Store questionnaire answers in references JSON field for admin review
            references: {
              questionnaireAnswers: {
                hasInsurance: questionnaire.hasInsurance,
                hasFireAlarmCO: questionnaire.hasFireAlarmCO,
                hasPets: questionnaire.hasPets,
                petsDescription: questionnaire.petsDescription || null,
                hasBackgroundCheck: questionnaire.hasBackgroundCheck,
                hasFirstAidCPR: questionnaire.hasFirstAidCPR,
                hasOtherCertifications: questionnaire.hasOtherCertifications || false,
                otherCertificationsDescription: questionnaire.otherCertificationsDescription || null,
                submittedAt: new Date().toISOString()
              }
            }
          }
        });

        console.log('Caregiver profile created via OAuth profile completion', {
          userId: user.id,
          caregiverId: caregiver.id
        });
      } else {
        // Update existing caregiver profile with questionnaire data
        await prisma.caregiver.update({
          where: { id: caregiver.id },
          data: {
            backgroundCheck: questionnaire.hasBackgroundCheck === true,
          }
        });

        // Update or create verification record
        const existingVerification = await prisma.caregiverVerification.findUnique({
          where: { caregiverId: caregiver.id }
        });

        if (existingVerification) {
          await prisma.caregiverVerification.update({
            where: { caregiverId: caregiver.id },
            data: {
              backgroundCheckStatus: (questionnaire.hasBackgroundCheck ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
              insuranceStatus: (questionnaire.hasInsurance ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
              references: {
                questionnaireAnswers: {
                  hasInsurance: questionnaire.hasInsurance,
                  hasFireAlarmCO: questionnaire.hasFireAlarmCO,
                  hasPets: questionnaire.hasPets,
                  petsDescription: questionnaire.petsDescription || null,
                  hasBackgroundCheck: questionnaire.hasBackgroundCheck,
                  hasFirstAidCPR: questionnaire.hasFirstAidCPR,
                  hasOtherCertifications: questionnaire.hasOtherCertifications || false,
                  otherCertificationsDescription: questionnaire.otherCertificationsDescription || null,
                  submittedAt: new Date().toISOString()
                }
              }
            }
          });
        } else {
          await prisma.caregiverVerification.create({
            data: {
              caregiverId: caregiver.id,
              idVerificationStatus: 'PENDING' as VerificationStatus,
              backgroundCheckStatus: (questionnaire.hasBackgroundCheck ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
              insuranceStatus: (questionnaire.hasInsurance ? 'SELF_DECLARED' : 'PENDING') as VerificationStatus,
              referencesStatus: 'PENDING' as VerificationStatus,
              references: {
                questionnaireAnswers: {
                  hasInsurance: questionnaire.hasInsurance,
                  hasFireAlarmCO: questionnaire.hasFireAlarmCO,
                  hasPets: questionnaire.hasPets,
                  petsDescription: questionnaire.petsDescription || null,
                  hasBackgroundCheck: questionnaire.hasBackgroundCheck,
                  hasFirstAidCPR: questionnaire.hasFirstAidCPR,
                  hasOtherCertifications: questionnaire.hasOtherCertifications || false,
                  otherCertificationsDescription: questionnaire.otherCertificationsDescription || null,
                  submittedAt: new Date().toISOString()
                }
              }
            }
          });
        }
      }
    }

    return apiSuccess(undefined, 'Profile completed successfully');

  } catch (error) {
    console.error('Profile completion error:', error);
    return ApiErrors.internal('Failed to complete profile. Please try again.');
  }
}

// GET endpoint to check if profile is complete
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token?.email) {
      return ApiErrors.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      include: { profile: true }
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    // Check if profile is complete
    const profile = user.profile;
    const isComplete = profile &&
      profile.phone &&
      profile.phone.length > 0 &&
      profile.dateOfBirth !== null &&
      profile.streetAddress &&
      profile.streetAddress.length > 0 &&
      profile.city &&
      profile.city.length > 0 &&
      profile.state &&
      profile.state.length > 0 &&
      profile.zipCode &&
      profile.zipCode.length > 0;

    return apiSuccess({
      isComplete,
      profile: profile ? {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        streetAddress: profile.streetAddress,
        apartment: profile.apartment,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        country: profile.country,
      } : null
    });

  } catch (error) {
    console.error('Profile check error:', error);
    return ApiErrors.internal('Failed to check profile status');
  }
}
