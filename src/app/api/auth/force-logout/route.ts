import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

// ✅ Changed from GET to POST to prevent CSRF attacks
// SameSite=Lax cookies block cross-site POST requests
export async function POST(request: NextRequest) {
  try {
    // ✅ STEP 1: Require ADMIN authentication (only admins can force logout)
    const authResult = await withAuth(request, 'ADMIN');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized force logout attempt', {
        endpoint: '/api/auth/force-logout',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const adminUser = authResult.user;
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ✅ Log admin action for audit trail
    logger.audit('Admin forced logout', {
      adminId: adminUser.id,
      adminEmail: adminUser.email
    });

    // Clear all NextAuth cookies
    const cookieStore = await cookies();

    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('__Secure-next-auth.session-token');
    cookieStore.delete('next-auth.csrf-token');
    cookieStore.delete('__Host-next-auth.csrf-token');
    cookieStore.delete('next-auth.callback-url');

    return NextResponse.json({
      success: true,
      message: 'All auth cookies cleared. Please log in again.',
      redirect: '/login'
    });
  } catch (error) {
    logger.error('Failed to force logout', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to force logout' },
      { status: 500 }
    );
  }
}

// Explicitly reject GET requests with helpful error
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST request.' },
    { status: 405 }
  );
}
