import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET — Batch check which providers are favorited
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) return authResult.response;

    const user = authResult.user!;
    const providerIds = request.nextUrl.searchParams.get('providerIds');

    if (!providerIds) {
      return apiSuccess({ favorites: {} });
    }

    const ids = providerIds.split(',').filter(Boolean).slice(0, 100); // Limit to 100

    if (ids.length === 0) {
      return apiSuccess({ favorites: {} });
    }

    const favorites = await db.favorite.findMany({
      where: {
        userId: user.id,
        providerId: { in: ids },
      },
      select: { providerId: true },
    });

    const favoriteMap: Record<string, boolean> = {};
    for (const id of ids) {
      favoriteMap[id] = false;
    }
    for (const fav of favorites) {
      favoriteMap[fav.providerId] = true;
    }

    return apiSuccess({ favorites: favoriteMap });
  } catch (error) {
    console.error('Error checking favorites:', error);
    return ApiErrors.internal('Failed to check favorites');
  }
}
