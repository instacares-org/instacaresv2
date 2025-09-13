import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { SECURITY_CONFIG, logSecurityEvent } from './security-config';

/**
 * Enhanced authentication middleware for API routes
 */
export async function withAuth(
  request: NextRequest,
  requiredUserType?: 'PARENT' | 'CAREGIVER' | 'ADMIN' | 'ANY',
  requireApproval: boolean = true
) {
  try {
    // Get NextAuth token
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (!token || !token.email) {
      logSecurityEvent('AUTH_FAILURE', { 
        reason: 'No valid token',
        path: request.nextUrl.pathname,
        ip: request.ip 
      });
      
      return {
        isAuthorized: false,
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    // Check if user is active
    if (!token.isActive) {
      logSecurityEvent('AUTH_FAILURE', { 
        reason: 'User inactive',
        email: token.email,
        path: request.nextUrl.pathname 
      });
      
      return {
        isAuthorized: false,
        response: NextResponse.json(
          { error: 'Account is inactive' },
          { status: 403 }
        ),
      };
    }

    // Check approval status (unless admin)
    if (requireApproval && token.userType !== 'ADMIN' && token.approvalStatus !== 'APPROVED') {
      logSecurityEvent('AUTH_FAILURE', { 
        reason: 'User not approved',
        email: token.email,
        approvalStatus: token.approvalStatus,
        path: request.nextUrl.pathname 
      });
      
      return {
        isAuthorized: false,
        response: NextResponse.json(
          { error: 'Account pending approval' },
          { status: 403 }
        ),
      };
    }

    // Check user type authorization
    if (requiredUserType && requiredUserType !== 'ANY') {
      if (token.userType !== requiredUserType && token.userType !== 'ADMIN') {
        logSecurityEvent('AUTH_FAILURE', { 
          reason: 'Insufficient permissions',
          email: token.email,
          userType: token.userType,
          requiredType: requiredUserType,
          path: request.nextUrl.pathname 
        });
        
        return {
          isAuthorized: false,
          response: NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          ),
        };
      }
    }

    // Check session expiry and refresh if needed
    const tokenExp = token.exp as number;
    const now = Math.floor(Date.now() / 1000);
    
    if (tokenExp < now) {
      logSecurityEvent('AUTH_FAILURE', { 
        reason: 'Token expired',
        email: token.email,
        exp: tokenExp,
        now: now,
        path: request.nextUrl.pathname 
      });
      
      return {
        isAuthorized: false,
        response: NextResponse.json(
          { error: 'Session expired, please login again' },
          { status: 401 }
        ),
      };
    }

    return {
      isAuthorized: true,
      user: {
        id: token.sub as string,
        email: token.email as string,
        userType: token.userType as string,
        approvalStatus: token.approvalStatus as string,
        isActive: token.isActive as boolean,
      },
    };

  } catch (error) {
    logSecurityEvent('AUTH_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.nextUrl.pathname 
    });
    
    return {
      isAuthorized: false,
      response: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Rate limiting specifically for authentication endpoints
 */
const authRateLimitStore = new Map<string, { count: number; resetTime: number; failures: number }>();

export function withAuthRateLimit(request: NextRequest, isFailedAttempt: boolean = false) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const key = `auth:${clientIP}`;
  const now = Date.now();
  const config = SECURITY_CONFIG.RATE_LIMITS.AUTH_ENDPOINTS;

  let record = authRateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + config.WINDOW_MS, failures: 0 };
    authRateLimitStore.set(key, record);
  }

  if (isFailedAttempt) {
    record.failures += 1;
    
    // Enhanced rate limiting for failed attempts
    if (record.failures >= 3) {
      const enhancedLimit = Math.floor(config.REQUESTS / 2);
      if (record.count >= enhancedLimit) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', { 
          ip: clientIP,
          failures: record.failures,
          path: request.nextUrl.pathname 
        });
        
        return {
          isAllowed: false,
          response: NextResponse.json(
            { error: 'Too many failed attempts. Please try again later.' },
            { 
              status: 429,
              headers: {
                'Retry-After': Math.ceil(config.WINDOW_MS / 1000).toString(),
              }
            }
          ),
        };
      }
    }
  }

  record.count += 1;

  if (record.count > config.REQUESTS) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { 
      ip: clientIP,
      count: record.count,
      path: request.nextUrl.pathname 
    });
    
    return {
      isAllowed: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil(config.WINDOW_MS / 1000).toString(),
          }
        }
      ),
    };
  }

  return { isAllowed: true };
}

/**
 * Security headers helper
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', SECURITY_CONFIG.HEADERS.HSTS);
  }
  
  return response;
}

/**
 * Input validation middleware
 */
export function validateInput(data: any, rules: Record<string, any>) {
  const errors: string[] = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    if (rule.required && (!value || value.toString().trim() === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value && rule.maxLength && value.toString().length > rule.maxLength) {
      errors.push(`${field} must be less than ${rule.maxLength} characters`);
    }
    
    if (value && rule.minLength && value.toString().length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`);
    }
    
    if (value && rule.pattern && !rule.pattern.test(value.toString())) {
      errors.push(`${field} format is invalid`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}