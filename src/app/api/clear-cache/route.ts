import { NextRequest, NextResponse } from 'next/server';

// Simple cache clearing endpoint for debugging
export async function POST(request: NextRequest) {
  try {
    const { apiCache } = await import('@/lib/cache');
    
    // Clear all cached data
    apiCache.clear();
    
    console.log('✅ All cache cleared');
    
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