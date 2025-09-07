import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateToken, createAuthCookieConfig } from '@/lib/jwt';
import { getUserById } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get current token from request
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : cookieToken;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    // Verify current token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get fresh user data to ensure account is still valid
    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is still approved
    if (user.userType !== 'ADMIN' && user.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'Account not approved' },
        { status: 403 }
      );
    }

    // Generate new token with fresh data
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      userType: user.userType,
      approvalStatus: user.approvalStatus
    });

    // Create response with new token
    const response = NextResponse.json({
      success: true,
      data: {
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          approvalStatus: user.approvalStatus
        }
      }
    });

    // Set new auth cookie
    const cookieConfig = createAuthCookieConfig(
      process.env.NODE_ENV === 'production'
    );
    
    response.cookies.set(
      cookieConfig.name,
      newToken,
      cookieConfig.options
    );

    return response;

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}