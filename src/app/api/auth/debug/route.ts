import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest, extractTokenFromRequest } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Debug authentication
    const token = extractTokenFromRequest(request);
    const cookieStore = cookies();
    const authCookie = cookieStore.get('auth-token');
    
    const authResult = verifyTokenFromRequest(request);
    
    return NextResponse.json({
      debug: {
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : null,
        hasCookie: !!authCookie,
        cookiePreview: authCookie ? `${authCookie.value.substring(0, 20)}...` : null,
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