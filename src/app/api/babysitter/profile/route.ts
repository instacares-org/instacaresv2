import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, apiSuccess, ApiErrors } from '@/lib/api-utils';

// Validation schema for profile update
const profileUpdateSchema = z.object({
  bio: z.string().min(10).max(500).optional(),
  experienceSummary: z.string().max(1000).optional(),
  hourlyRate: z.number().min(15).max(100).optional(),
  isAvailable: z.boolean().optional(),
  maxChildren: z.number().min(1).max(6).optional(),
  ageGroupsServed: z.array(z.string()).optional(),
  acceptsOnsitePayment: z.boolean().optional(),
});

// GET - Get full babysitter profile (public view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const babysitterId = searchParams.get('id');

    // If ID provided, get public profile
    if (babysitterId) {
      const babysitter = await db.babysitter.findUnique({
        where: { id: babysitterId },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  city: true,
                  state: true,
                }
              }
            }
          },
          reviews: {
            where: { isApproved: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }
        }
      });

      if (!babysitter || babysitter.status !== 'APPROVED') {
        return ApiErrors.notFound('Babysitter not found');
      }

      // Build trust badges
      const trustBadges = [];
      if (babysitter.governmentIdFront && babysitter.selfieForMatch) {
        trustBadges.push({ type: 'VERIFIED_ID', label: 'Verified ID' });
      }
      if (babysitter.policeCheck) {
        trustBadges.push({ type: 'BACKGROUND_CHECKED', label: 'Background Checked' });
      }
      if (babysitter.phoneVerified) {
        trustBadges.push({ type: 'PHONE_VERIFIED', label: 'Phone Verified' });
      }
      if (babysitter.cprCertificate) {
        trustBadges.push({ type: 'CPR_CERTIFIED', label: 'CPR Certified' });
      }
      if (babysitter.eceCertificate) {
        trustBadges.push({ type: 'ECE_TRAINED', label: 'ECE Trained' });
      }
      if (babysitter.stripeOnboarded) {
        trustBadges.push({ type: 'SECURE_PAYMENTS', label: 'Secure Payments' });
      }

      return apiSuccess({
        id: babysitter.id,
        firstName: babysitter.user.profile?.firstName,
        lastName: babysitter.user.profile?.lastName?.charAt(0) + '.', // Privacy: only show initial
        avatar: babysitter.user.profile?.avatar,
        city: babysitter.user.profile?.city,
        state: babysitter.user.profile?.state,
        bio: babysitter.bio,
        experienceYears: babysitter.experienceYears,
        experienceSummary: babysitter.experienceSummary,
        hourlyRate: babysitter.hourlyRate,
        isAvailable: babysitter.isAvailable,
        maxChildren: babysitter.maxChildren,
        ageGroupsServed: babysitter.ageGroupsServed,
        totalBookings: babysitter.totalBookings,
        averageRating: babysitter.averageRating,
        acceptsOnsitePayment: babysitter.acceptsOnsitePayment,
        stripeOnboarded: babysitter.stripeOnboarded,
        trustBadges,
        reviews: babysitter.reviews.map(r => ({
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
      });
    }

    // No ID - get current user's own profile
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const babysitter = await db.babysitter.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        references: true,
        reviews: {
          where: { isApproved: true },
          orderBy: { createdAt: 'desc' },
        }
      }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    return apiSuccess({ babysitter, profile: babysitter.user.profile });

  } catch (error) {
    console.error('Get babysitter profile error:', error);
    return ApiErrors.internal('Failed to get profile');
  }
}

// PATCH - Update babysitter profile
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = profileUpdateSchema.parse(body);

    const babysitter = await db.babysitter.findUnique({
      where: { userId: user.id }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    const updated = await db.babysitter.update({
      where: { id: babysitter.id },
      data: validatedData
    });

    return apiSuccess({ babysitter: updated }, 'Profile updated successfully');

  } catch (error) {
    console.error('Update babysitter profile error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to update profile');
  }
}
