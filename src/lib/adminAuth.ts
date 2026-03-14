import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';
import { ApiErrors } from '@/lib/api-utils';

const ADMIN_TYPES = ['ADMIN', 'SUPERVISOR'] as const;

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
 * Verify admin/supervisor authentication from request using NextAuth JWT token.
 * Uses getToken() directly (reads cookies from the request) — more reliable
 * than getServerSession() in Next.js 15 App Router route handlers.
 */
export async function verifyAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token || !token.email) {
      return {
        success: false,
        error: 'No authentication session found. Please log in as admin.'
      };
    }

    const userType = token.userType as string;
    if (!ADMIN_TYPES.includes(userType as typeof ADMIN_TYPES[number])) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    return {
      success: true,
      user: {
        id: (token.userId || token.sub) as string,
        email: token.email as string,
        userType,
      }
    };

  } catch (error) {
    console.error('[verifyAdminAuth] Error:', error);
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
  canApproveUsers: boolean;
  canManageUsers: boolean;
  canModerateReviews: boolean;
  canModerateChat: boolean;
  canViewFinancials: boolean;
  canProcessPayouts: boolean;
  canManageExtensions: boolean;
  canViewAnalytics: boolean;
  canViewAuditLogs: boolean;
  canManageSupport: boolean;
  canManageWarnings: boolean;
  canManageNotifications: boolean;
  canManageSupervisors: boolean;
  canManageSettings: boolean;
}

const ALL_PERMISSIONS_TRUE: AdminPermissions = {
  canApproveUsers: true,
  canManageUsers: true,
  canModerateReviews: true,
  canModerateChat: true,
  canViewFinancials: true,
  canProcessPayouts: true,
  canManageExtensions: true,
  canViewAnalytics: true,
  canViewAuditLogs: true,
  canManageSupport: true,
  canManageWarnings: true,
  canManageNotifications: true,
  canManageSupervisors: true,
  canManageSettings: true,
};

const ALL_PERMISSIONS_FALSE: AdminPermissions = {
  canApproveUsers: false,
  canManageUsers: false,
  canModerateReviews: false,
  canModerateChat: false,
  canViewFinancials: false,
  canProcessPayouts: false,
  canManageExtensions: false,
  canViewAnalytics: false,
  canViewAuditLogs: false,
  canManageSupport: false,
  canManageWarnings: false,
  canManageNotifications: false,
  canManageSupervisors: false,
  canManageSettings: false,
};

export async function getAdminPermissions(adminUser: { id: string; email: string; userType: string }): Promise<AdminPermissions> {
  // Admins get all permissions
  if (adminUser.userType === 'ADMIN') {
    return { ...ALL_PERMISSIONS_TRUE };
  }

  // Supervisors get database-driven permissions
  const perms = await prisma.supervisorPermission.findUnique({
    where: { userId: adminUser.id },
  });

  if (!perms) {
    return { ...ALL_PERMISSIONS_FALSE };
  }

  return {
    canApproveUsers: perms.canApproveUsers,
    canManageUsers: perms.canManageUsers,
    canModerateReviews: perms.canModerateReviews,
    canModerateChat: perms.canModerateChat,
    canViewFinancials: perms.canViewFinancials,
    canProcessPayouts: perms.canProcessPayouts,
    canManageExtensions: perms.canManageExtensions,
    canViewAnalytics: perms.canViewAnalytics,
    canViewAuditLogs: perms.canViewAuditLogs,
    canManageSupport: perms.canManageSupport,
    canManageWarnings: perms.canManageWarnings,
    canManageNotifications: perms.canManageNotifications,
    canManageSupervisors: false, // Never for supervisors
    canManageSettings: false,    // Never for supervisors
  };
}

/**
 * Check if user has a specific permission (combines auth + permission check)
 */
export async function requirePermission(
  request: NextRequest,
  permission: keyof AdminPermissions
): Promise<{ authorized: boolean; user?: AdminAuthResult['user']; response?: NextResponse }> {
  const auth = await verifyAdminAuth(request);
  if (!auth.success || !auth.user) {
    return { authorized: false, response: ApiErrors.unauthorized() };
  }

  const perms = await getAdminPermissions(auth.user);
  if (!perms[permission]) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user: auth.user };
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