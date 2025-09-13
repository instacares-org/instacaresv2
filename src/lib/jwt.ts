import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// JWT configuration with build-time fallback
const getJWTConfig = () => {
  const secret = process.env.JWT_SECRET;
  
  // During build process, we might not have environment variables
  // Check if we're in a build context by looking for SKIP_ENV_VALIDATION
  const isBuildTime = process.env.SKIP_ENV_VALIDATION === 'true' || 
                      process.env.NEXT_PHASE === 'phase-production-build';
  
  if (!secret || secret.includes('your-jwt-secret') || secret === 'test') {
    // Only throw error in production runtime, not during build
    if (process.env.NODE_ENV === 'production' && !isBuildTime) {
      console.error('JWT_SECRET not configured properly in production runtime');
      // Still return a fallback to prevent crashes during build
    }
    
    if (!isBuildTime) {
      console.warn('JWT_SECRET not configured, using fallback for development/build');
    }
    
    return {
      secret: 'instacares-development-fallback-secret-key-not-for-production',
      expiresIn: '7d'
    };
  }
  
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };
};

const jwtConfig = getJWTConfig();

export interface JWTPayload {
  userId: string;
  email: string;
  userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
  approvalStatus: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
  approvalStatus: string;
  profile?: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
  };
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string {
  // If remember me is true, token expires in 30 days, otherwise 7 days
  const expiresIn = rememberMe ? '30d' : jwtConfig.expiresIn;
  
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn,
    issuer: 'instacares',
    audience: 'instacares-users'
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: 'instacares',
      audience: 'instacares-users'
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract JWT token from request headers or cookies
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookies as fallback
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // For debugging: also try custom header
  const customToken = request.headers.get('x-auth-token');
  if (customToken) {
    return customToken;
  }

  return null;
}

/**
 * Verify user authentication from request
 */
export async function verifyAuthFromRequest(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  user?: JWTPayload;
  error?: string;
}> {
  const token = extractTokenFromRequest(request);
  
  if (!token) {
    return { isAuthenticated: false, error: 'No token provided' };
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return { isAuthenticated: false, error: 'Invalid token' };
  }

  // Check if user is approved (unless admin)
  if (payload.userType !== 'ADMIN' && payload.approvalStatus !== 'APPROVED') {
    return { 
      isAuthenticated: false, 
      error: 'Account not approved' 
    };
  }

  return { isAuthenticated: true, user: payload };
}

/**
 * Generate a secure refresh token (for future implementation)
 */
export function generateRefreshToken(): string {
  return jwt.sign(
    { type: 'refresh', timestamp: Date.now() },
    jwtConfig.secret + '-refresh',
    { expiresIn: '30d' }
  );
}

/**
 * Create auth cookie configuration
 */
export function createAuthCookieConfig(isProduction: boolean = false, rememberMe: boolean = false) {
  // If remember me is true, cookie expires in 30 days, otherwise 7 days
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
  
  return {
    name: 'auth-token',
    options: {
      httpOnly: true, // Secure: prevent XSS attacks
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict' as const, // CSRF protection
      maxAge, // in seconds
      path: '/',
      domain: isProduction ? '.instacares.net' : undefined,
    }
  };
}

/**
 * Check if token is expiring soon (within 1 hour)
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return true; // Treat as expiring if we can't decode
    }
    
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    return (expiryTime - currentTime) <= oneHour;
  } catch (error) {
    console.error('Token expiry check failed:', error);
    return true; // Treat as expiring on error
  }
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded?.exp ? decoded.exp * 1000 : null;
  } catch (error) {
    console.error('Token decode failed:', error);
    return null;
  }
}

/**
 * Verify token from NextRequest with proper error handling
 */
export function verifyTokenFromRequest(request: NextRequest): { isValid: boolean; user: JWTPayload | null; error?: string } {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token) {
      return { isValid: false, user: null, error: 'No token provided' };
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return { isValid: false, user: null, error: 'Invalid or expired token. Please log in again.' };
    }
    
    // Check if user is approved (unless admin)
    if (payload.userType !== 'ADMIN' && payload.approvalStatus !== 'APPROVED') {
      return { isValid: false, user: null, error: 'Account not approved' };
    }

    return { isValid: true, user: payload };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return { isValid: false, user: null, error: error instanceof Error ? error.message : 'Token verification failed' };
  }
}