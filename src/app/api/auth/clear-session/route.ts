import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // ✅ STEP 1: Require authentication (users can clear their own session)
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      // If not authenticated, still allow them to clear cookies and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      
      const cookieNames = [
        'next-auth.session-token',
        '__Secure-next-auth.session-token', 
        'next-auth.csrf-token',
        '__Secure-next-auth.csrf-token',
        '__Host-next-auth.csrf-token',
        'next-auth.callback-url',
      ];

      cookieNames.forEach(name => {
        response.cookies.set(name, '', {
          expires: new Date(0),
          path: '/',
          maxAge: 0,
        });
      });

      return response;
    }

    const user = authResult.user!;

    // ✅ Log user action
    logger.info('User cleared their session', {
      userId: user.id,
      userEmail: user.email
    });

    const response = NextResponse.redirect(new URL('/login', request.url));

    // Clear all possible NextAuth cookie variations
    const cookieNames = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token', 
      'next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      'next-auth.callback-url',
    ];

    cookieNames.forEach(name => {
      response.cookies.set(name, '', {
        expires: new Date(0),
        path: '/',
        maxAge: 0,
      });
    });

    return response;
  } catch (error) {
    console.error('Error clearing session:', error);
    // Even on error, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
