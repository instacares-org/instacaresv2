import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Log all parameters Google sends back
    const params: Record<string, string> = {};
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    
    console.log('OAuth callback parameters:', params);
    
    return NextResponse.json({
      success: true,
      url: request.url,
      params,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug callback error:', error);
    return NextResponse.json({
      error: 'Debug callback failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}