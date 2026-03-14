import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// Validation schema for babysitter registration (Step 1: Basic info)
const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().refine((date) => {
    const dob = new Date(date);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 18;
  }, 'Must be at least 18 years old'),
  bio: z.string().min(10, 'Bio must be at least 10 characters').max(500, 'Bio must be less than 500 characters'),
  experienceYears: z.number().min(0).max(50),
  experienceSummary: z.string().max(1000).optional(),
  hourlyRate: z.number().min(15, 'Minimum rate is $15/hour').max(100, 'Maximum rate is $100/hour'),
  phone: z.string().min(10, 'Valid phone number required'),
  streetAddress: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'Province is required'),
  zipCode: z.string().min(1, 'Postal code is required'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Check if user already has a babysitter profile
    const existingBabysitter = await db.babysitter.findUnique({
      where: { userId }
    });

    if (existingBabysitter) {
      return ApiErrors.badRequest('Babysitter profile already exists');
    }

    // Create or update user profile
    await db.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        streetAddress: validatedData.streetAddress,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
      },
      update: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        streetAddress: validatedData.streetAddress,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
      }
    });

    // Create babysitter profile
    const babysitter = await db.babysitter.create({
      data: {
        userId,
        bio: validatedData.bio,
        experienceYears: validatedData.experienceYears,
        experienceSummary: validatedData.experienceSummary,
        hourlyRate: validatedData.hourlyRate,
        status: 'PENDING_VERIFICATION',
      }
    });

    // Update user flags
    await db.user.update({
      where: { id: userId },
      data: {
        isBabysitter: true,
      }
    });

    return apiSuccess({
      babysitterId: babysitter.id,
      nextStep: 'documents'
    }, 'Babysitter registration started');

  } catch (error) {
    console.error('Babysitter registration error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to register babysitter');
  }
}

// GET - Check babysitter registration status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
      include: {
        references: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!babysitter) {
      return apiSuccess({
        registered: false,
        message: 'No babysitter profile found'
      });
    }

    // Calculate completion status
    const completionStatus = {
      basicInfo: true,
      documents: {
        governmentId: !!(babysitter.governmentIdFront && babysitter.governmentIdBack),
        policeCheck: !!babysitter.policeCheck,
        selfie: !!babysitter.selfieForMatch,
      },
      optionalCerts: {
        cpr: !!babysitter.cprCertificate,
        ece: !!babysitter.eceCertificate,
      },
      references: babysitter.references.length,
      verification: {
        phone: babysitter.phoneVerified,
        email: babysitter.emailVerified,
      }
    };

    return apiSuccess({
      registered: true,
      babysitter: {
        id: babysitter.id,
        status: babysitter.status,
        bio: babysitter.bio,
        experienceYears: babysitter.experienceYears,
        experienceSummary: babysitter.experienceSummary,
        hourlyRate: babysitter.hourlyRate,
        isAvailable: babysitter.isAvailable,
        totalBookings: babysitter.totalBookings,
        averageRating: babysitter.averageRating,
        stripeOnboarded: babysitter.stripeOnboarded,
        acceptsOnsitePayment: babysitter.acceptsOnsitePayment,
        createdAt: babysitter.createdAt,
        approvedAt: babysitter.approvedAt,
      },
      profile: babysitter.user.profile,
      completionStatus,
    });

  } catch (error) {
    console.error('Get babysitter status error:', error);
    return ApiErrors.internal('Failed to get babysitter status');
  }
}
