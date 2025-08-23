import { NextRequest, NextResponse } from 'next/server';
import { logger, getClientInfo } from '@/lib/logger';
import { verifyAuthFromRequest, createAuthCookieConfig } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    // Create response immediately
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
    
    // Clear the auth cookie
    const cookieConfig = createAuthCookieConfig(process.env.NODE_ENV === 'production');
    response.cookies.set(cookieConfig.name, '', {
      ...cookieConfig.options,
      maxAge: 0, // Expire immediately
    });
    
    // Log logout event in background (non-blocking)
    setImmediate(async () => {
      try {
        const clientInfo = getClientInfo(request);
        const authResult = await verifyAuthFromRequest(request);
        
        if (authResult.isAuthenticated && authResult.user) {
          logger.info('User logout', {
            userId: authResult.user.userId,
            email: authResult.user.email,
            userType: authResult.user.userType,
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
          });
        }
      } catch (error) {
        console.error('Background logout logging failed:', error);
      }
    });
    
    return response;
    
  } catch (error: any) {
    // Still clear the cookie even if there's an error
    const response = NextResponse.json(
      { success: true, message: 'Logged out' }
    );
    
    const cookieConfig = createAuthCookieConfig(process.env.NODE_ENV === 'production');
    response.cookies.set(cookieConfig.name, '', {
      ...cookieConfig.options,
      maxAge: 0,
    });
    
    return response;
  }
}