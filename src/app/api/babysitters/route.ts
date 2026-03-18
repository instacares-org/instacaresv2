import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET - Search/list babysitters (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Search parameters
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const minRate = searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined;
    const maxRate = searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined;
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const ageGroup = searchParams.get('ageGroup'); // infants, toddlers, schoolAge, teens
    const dayOfWeek = searchParams.get('dayOfWeek') ? parseInt(searchParams.get('dayOfWeek')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const sortBy = searchParams.get('sortBy') || 'rating'; // rating, rate, experience

    // Build where clause
    const where: Record<string, unknown> = {
      status: 'APPROVED',
      isAvailable: true,
    };

    // Rate filter
    if (minRate !== undefined || maxRate !== undefined) {
      where.hourlyRate = {};
      if (minRate !== undefined) (where.hourlyRate as Record<string, number>).gte = minRate;
      if (maxRate !== undefined) (where.hourlyRate as Record<string, number>).lte = maxRate;
    }

    // Rating filter
    if (minRating !== undefined) {
      where.averageRating = { gte: minRating };
    }

    // Location filter (via user profile)
    const profileWhere: Record<string, unknown> = {};
    if (city) profileWhere.city = { contains: city, mode: 'insensitive' };
    if (state) profileWhere.state = state;

    // Day of week availability filter
    const availabilityWhere = dayOfWeek !== undefined ? {
      some: {
        dayOfWeek,
        isActive: true,
      }
    } : undefined;

    // Age group filter (JSON array column - use Prisma array_contains for PostgreSQL jsonb)
    if (ageGroup) {
      where.ageGroupsServed = { array_contains: [ageGroup] };
    }

    // Fetch babysitters
    const babysitters = await db.babysitter.findMany({
      where: {
        ...where,
        user: {
          profile: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
        },
        availabilitySlots: availabilityWhere,
      },
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
        availabilitySlots: {
          where: { isActive: true },
          select: {
            recurrenceType: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            specificDate: true,
            dayOfMonth: true,
            repeatInterval: true,
          }
        },
        _count: {
          select: {
            reviews: {
              where: { isApproved: true }
            }
          }
        }
      },
      orderBy: sortBy === 'rating'
        ? { averageRating: 'desc' }
        : sortBy === 'rate'
        ? { hourlyRate: 'asc' }
        : { experienceYears: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await db.babysitter.count({
      where: {
        ...where,
        user: {
          profile: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
        },
        availabilitySlots: availabilityWhere,
      }
    });

    // Build trust badges for each babysitter
    const results = babysitters.map(b => {
      const trustBadges = [];
      if (b.governmentIdFront && b.selfieForMatch) {
        trustBadges.push('VERIFIED_ID');
      }
      if (b.policeCheck) {
        trustBadges.push('BACKGROUND_CHECKED');
      }
      if (b.phoneVerified) {
        trustBadges.push('PHONE_VERIFIED');
      }
      if (b.cprCertificate) {
        trustBadges.push('CPR_CERTIFIED');
      }
      if (b.eceCertificate) {
        trustBadges.push('ECE_TRAINED');
      }
      if (b.stripeOnboarded) {
        trustBadges.push('SECURE_PAYMENTS');
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      return {
        id: b.id,
        firstName: b.user.profile?.firstName,
        lastName: b.user.profile?.lastName?.charAt(0) + '.', // Privacy
        avatar: b.user.profile?.avatar,
        city: b.user.profile?.city,
        state: b.user.profile?.state,
        bio: b.bio?.substring(0, 150) + (b.bio && b.bio.length > 150 ? '...' : ''),
        experienceYears: b.experienceYears,
        hourlyRate: b.hourlyRate,
        averageRating: b.averageRating,
        totalBookings: b.totalBookings,
        reviewCount: b._count.reviews,
        acceptsOnsitePayment: b.acceptsOnsitePayment,
        stripeOnboarded: b.stripeOnboarded,
        trustBadges,
        trustBadgeCount: trustBadges.length,
        availability: b.availabilitySlots.map(s => ({
          recurrenceType: s.recurrenceType,
          day: s.dayOfWeek != null ? dayNames[s.dayOfWeek] : null,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          specificDate: s.specificDate,
          dayOfMonth: s.dayOfMonth,
          repeatInterval: s.repeatInterval,
        })),
      };
    });

    return apiSuccess({
      babysitters: results,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      }
    });

  } catch (error) {
    console.error('Search babysitters error:', error);
    return ApiErrors.internal('Failed to search babysitters');
  }
}
