import { NextRequest } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth-middleware';

// Admin-only cache clearing endpoint
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await withAuth(request, 'ADMIN');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }
    
    const { apiCache } = await import('@/lib/cache');
    
    // Clear all cached data
    await apiCache.clear();
    
    
    return apiSuccess(undefined, 'Cache cleared successfully');

  } catch (error) {
    console.error('Cache clear error:', error);
    return ApiErrors.internal('Failed to clear cache');
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
