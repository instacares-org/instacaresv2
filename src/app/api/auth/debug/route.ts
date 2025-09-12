import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest, extractTokenFromRequest } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Debug authentication
    const token = extractTokenFromRequest(request);
    const cookieStore = cookies();
    const authCookie = cookieStore.get('auth-token');
    
    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    
    const authResult = verifyTokenFromRequest(request);
    
    // Check request headers
    const authHeader = request.headers.get('authorization');
    
    return NextResponse.json({
      debug: {
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : null,
        hasCookie: !!authCookie,
        cookiePreview: authCookie ? `${authCookie.value.substring(0, 20)}...` : null,
        allCookiesCount: allCookies.length,
        allCookieNames: allCookies.map(c => c.name),
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader ? `${authHeader.substring(0, 20)}...` : null,
        userAgent: request.headers.get('user-agent')?.substring(0, 50),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        authResult: {
          isValid: authResult.isValid,
          error: authResult.error,
          user: authResult.user ? {
            userId: authResult.user.userId,
            email: authResult.user.email,
            userType: authResult.user.userType,
            approvalStatus: authResult.user.approvalStatus,
          } : null
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Debug failed',
      debug: 'Authentication debug endpoint failed'
    }, { status: 500 });
  }
}