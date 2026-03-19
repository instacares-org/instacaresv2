import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// POST — Toggle favorite (add or remove)
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) return authResult.response;

    const user = authResult.user!;
    const body = await request.json();
    const { providerId } = body;

    if (!providerId || typeof providerId !== 'string') {
      return ApiErrors.badRequest('providerId is required');
    }

    // Prevent self-favoriting
    if (providerId === user.id) {
      return ApiErrors.badRequest('Cannot favorite yourself');
    }

    // Verify provider exists and is an active caregiver or babysitter
    const provider = await db.user.findUnique({
      where: { id: providerId },
      select: { id: true, isActive: true, isCaregiver: true, isBabysitter: true },
    });

    if (!provider || !provider.isActive || (!provider.isCaregiver && !provider.isBabysitter)) {
      return ApiErrors.notFound('Provider not found');
    }

    // Check if already favorited
    const existing = await db.favorite.findUnique({
      where: { userId_providerId: { userId: user.id, providerId } },
    });

    if (existing) {
      // Unfavorite
      await db.favorite.delete({ where: { id: existing.id } });
      return apiSuccess({ isFavorited: false });
    } else {
      // Favorite
      await db.favorite.create({
        data: { userId: user.id, providerId },
      });
      return apiSuccess({ isFavorited: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return ApiErrors.internal('Failed to update favorite');
  }
}

// GET — List all favorites for the current user
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) return authResult.response;

    const user = authResult.user!;

    const favorites = await db.favorite.findMany({
      where: { userId: user.id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
            isCaregiver: true,
            isBabysitter: true,
            isActive: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
                city: true,
                state: true,
              },
            },
            _count: {
              select: { receivedReviews: true },
            },
            caregiver: {
              select: {
                id: true,
                hourlyRate: true,
                experienceYears: true,
                bio: true,
                specialties: true,
                averageRating: true,
                stripeOnboarded: true,
                canReceivePayments: true,
              },
            },
            babysitter: {
              select: {
                id: true,
                hourlyRate: true,
                experienceYears: true,
                bio: true,
                averageRating: true,
                acceptsOnsitePayment: true,
                stripeOnboarded: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out inactive providers
    const activeFavorites = favorites.filter(f => f.provider.isActive);

    return apiSuccess({ favorites: activeFavorites });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return ApiErrors.internal('Failed to fetch favorites');
  }
}
