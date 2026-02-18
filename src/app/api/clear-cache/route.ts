import { NextRequest, NextResponse } from 'next/server';
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
    apiCache.clear();
    
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    });
    
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json({ 
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
