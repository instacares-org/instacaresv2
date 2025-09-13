import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Debug NextAuth session
    const session = await getServerSession(authOptions);
    const cookieStore = cookies();
    
    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    
    // Check NextAuth session cookie
    const sessionCookie = cookieStore.get('next-auth.session-token') || cookieStore.get('__Secure-next-auth.session-token');
    
    // Check request headers
    const authHeader = request.headers.get('authorization');
    
    return NextResponse.json({
      debug: {
        hasSession: !!session,
        sessionUser: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          userType: session.user.userType,
          approvalStatus: session.user.approvalStatus
        } : null,
        hasSessionCookie: !!sessionCookie,
        sessionCookiePreview: sessionCookie ? `${sessionCookie.value.substring(0, 20)}...` : null,
        allCookiesCount: allCookies.length,
        allCookieNames: allCookies.map(c => c.name),
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader ? `${authHeader.substring(0, 20)}...` : null,
        userAgent: request.headers.get('user-agent')?.substring(0, 50),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        nextAuthStatus: {
          isAuthenticated: !!session,
          sessionExpires: session?.expires || null
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Debug failed',
      debug: 'NextAuth debug endpoint failed'
    }, { status: 500 });
  }
}