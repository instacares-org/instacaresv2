import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export interface AdminAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    userType: string;
  };
  error?: string;
}

/**
 * Verify admin authentication from request using NextAuth session
 */
export async function verifyAdminAuth(request?: NextRequest): Promise<AdminAuthResult> {
  try {
    // First try NextAuth session (preferred method)
    const session = await getServerSession(authOptions);

    if (session?.user?.userType === 'ADMIN' && session.user.email && session.user.id) {
      return {
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          userType: session.user.userType
        }
      };
    }

    // Fallback to custom JWT token (for backward compatibility)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      return {
        success: false,
        error: 'No authentication session found. Please log in as admin.'
      };
    }

    // Verify JWT token
    const decoded = jwt.verify(token.value, process.env.JWT_SECRET || 'fallback-secret') as any;

    if (decoded.userType !== 'ADMIN') {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    return {
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        userType: decoded.userType
      }
    };

  } catch (error) {
    return {
      success: false,
      error: 'Invalid authentication. Please log in as admin.'
    };
  }
}

/**
 * Admin authentication middleware for API routes
 */
export function requireAdminAuth(handler: (request: NextRequest, context?: any) => Promise<any>) {
  return async (request: NextRequest, context?: any) => {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add admin user to request context
    (request as any).adminUser = authResult.user;
    
    return handler(request, context);
  };
}

/**
 * Log admin actions for audit trail
 */
export interface AdminAction {
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export function logAdminAction(action: AdminAction): void {
  // In production, this would write to a secure audit log
  console.log('🔒 ADMIN ACTION:', {
    timestamp: action.timestamp.toISOString(),
    admin: `${action.adminEmail} (${action.adminId})`,
    action: action.action,
    resource: action.resource,
    resourceId: action.resourceId,
    ip: action.ip,
    userAgent: action.userAgent?.substring(0, 100) + (action.userAgent && action.userAgent.length > 100 ? '...' : ''),
    details: action.details
  });
}

/**
 * Rate limiting for admin actions
 */
const adminActionLimits = new Map<string, { count: number; resetTime: number }>();

export function checkAdminRateLimit(adminId: string, actionType: string, maxActions: number = 10, windowMs: number = 60000): boolean {
  const key = `${adminId}:${actionType}`;
  const now = Date.now();
  
  const current = adminActionLimits.get(key);
  
  if (!current || now > current.resetTime) {
    adminActionLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxActions) {
    return false;
  }
  
  current.count++;
  return true;
}

/**
 * Validate admin session and permissions
 */
export interface AdminPermissions {
  canModerateReviews: boolean;
  canManageUsers: boolean;
  canViewFinancials: boolean;
  canAccessLogs: boolean;
  canManageSystem: boolean;
}

export function getAdminPermissions(adminUser: { id: string; email: string }): AdminPermissions {
  // In a real system, this would be database-driven
  // For now, all admins have full permissions
  return {
    canModerateReviews: true,
    canManageUsers: true,
    canViewFinancials: true,
    canAccessLogs: true,
    canManageSystem: true
  };
}

/**
 * Security headers for admin pages
 */
export function addAdminSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy for admin pages
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  return response;
}