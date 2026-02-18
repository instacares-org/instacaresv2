import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

/**
 * GET /api/users/status
 * Check user account status
 * 
 * SECURITY:
 * - Requires authentication
 * - Users can only check their own status
 * - Admins can check any user's status
 */
export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // ✅ STEP 1: Verify authentication
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized user status check attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        url: request.url
      });
      return authResult.response;
    }

    const authenticatedUser = authResult.user;
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const requestedEmail = searchParams.get('email');

    if (!requestedEmail) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // ✅ STEP 2: Authorization check - can user access this data?
    const isAdmin = authenticatedUser.userType === 'ADMIN';
    const isOwnEmail = authenticatedUser.email === requestedEmail;

    if (!isAdmin && !isOwnEmail) {
      // ⚠️ SECURITY: User trying to access someone else's data
      logger.security('IDOR attempt detected - User tried to access another users status', {
        attackerUserId: authenticatedUser.id,
        attackerEmail: authenticatedUser.email,
        requestedEmail,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        url: request.url
      });

      return NextResponse.json(
        { error: 'Unauthorized - You can only check your own account status' },
        { status: 403 }
      );
    }

    // ✅ STEP 3: Fetch user data (now authorized)
    const user = await db.user.findUnique({
      where: { email: requestedEmail },
      select: {
        id: true,
        email: true,
        userType: true,
        approvalStatus: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 404 }
      );
    }

    // ✅ STEP 4: Log access for audit trail
    logger.info('User status checked', {
      checkedBy: authenticatedUser.id,
      checkedUser: user.id,
      isAdmin,
      ip: clientInfo.ip
    });

    return NextResponse.json({ 
      user,
      meta: {
        accessedBy: isAdmin ? 'admin' : 'self',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error checking user status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Failed to check account status' },
      { status: 500 }
    );
  }
}
