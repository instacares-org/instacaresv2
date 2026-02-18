import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// ============================================================
// Standardized API Response Helpers
// ============================================================

/**
 * Standard success response.
 * Shape: { success: true, data?, message? }
 */
export function apiSuccess<T>(data?: T, message?: string, status: number = 200) {
  return NextResponse.json(
    { success: true, ...(data !== undefined && { data }), ...(message && { message }) },
    { status }
  );
}

/**
 * Standard error response.
 * Shape: { success: false, error, details? }
 */
export function apiError(error: string, status: number = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error, ...(details !== undefined && { details }) },
    { status }
  );
}

/**
 * Common error responses as shortcuts.
 */
export const ApiErrors = {
  unauthorized: (msg = 'Authentication required') => apiError(msg, 401),
  forbidden: (msg = 'Insufficient permissions') => apiError(msg, 403),
  notFound: (msg = 'Resource not found') => apiError(msg, 404),
  badRequest: (msg = 'Invalid request', details?: unknown) => apiError(msg, 400, details),
  conflict: (msg = 'Resource already exists') => apiError(msg, 409),
  tooManyRequests: (msg = 'Rate limit exceeded') =>
    NextResponse.json(
      { success: false, error: msg },
      { status: 429, headers: { 'Retry-After': '60' } }
    ),
  internal: (msg = 'Internal server error') => apiError(msg, 500),
} as const;

// ============================================================
// Standardized Auth Helper (uses getServerSession)
// ============================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  userType: string;
  approvalStatus: string;
  isActive: boolean;
  isParent: boolean;
  isCaregiver: boolean;
  isBabysitter: boolean;
  activeRole: string;
}

type RequireAuthSuccess = { user: AuthenticatedUser; error?: undefined };
type RequireAuthFailure = { user?: undefined; error: NextResponse };

/**
 * Unified auth check for API route handlers.
 *
 * Usage:
 *   const { user, error } = await requireAuth();
 *   if (error) return error;
 *   // user is now typed and available
 *
 * With role check:
 *   const { user, error } = await requireAuth('ADMIN');
 *   if (error) return error;
 */
export async function requireAuth(
  requiredRole?: 'PARENT' | 'CAREGIVER' | 'ADMIN' | 'BABYSITTER'
): Promise<RequireAuthSuccess | RequireAuthFailure> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: ApiErrors.unauthorized() };
  }

  const u = session.user as any;

  if (u.isActive === false) {
    return { error: ApiErrors.forbidden('Account is inactive') };
  }

  const user: AuthenticatedUser = {
    id: u.id,
    email: u.email || '',
    userType: u.activeRole || u.userType || 'PARENT',
    approvalStatus: u.approvalStatus || 'APPROVED',
    isActive: u.isActive !== false,
    isParent: u.isParent ?? (u.userType === 'PARENT'),
    isCaregiver: u.isCaregiver ?? (u.userType === 'CAREGIVER'),
    isBabysitter: u.isBabysitter ?? false,
    activeRole: u.activeRole || u.userType || 'PARENT',
  };

  // Role check
  if (requiredRole) {
    const isAdmin = user.userType === 'ADMIN';
    let hasRole = isAdmin; // Admins bypass role checks

    if (!hasRole) {
      switch (requiredRole) {
        case 'PARENT':
          hasRole = user.isParent || user.userType === 'PARENT';
          break;
        case 'CAREGIVER':
          hasRole = user.isCaregiver || user.userType === 'CAREGIVER';
          break;
        case 'BABYSITTER':
          hasRole = user.isBabysitter;
          break;
        case 'ADMIN':
          hasRole = false; // Already checked above
          break;
      }
    }

    if (!hasRole) {
      return { error: ApiErrors.forbidden() };
    }
  }

  return { user };
}

/**
 * Require admin auth specifically. Shorthand for requireAuth('ADMIN').
 */
export async function requireAdmin(): Promise<RequireAuthSuccess | RequireAuthFailure> {
  return requireAuth('ADMIN');
}
