import { NextRequest, NextResponse } from 'next/server';
import { verifyCSRFProtection, setCSRFToken } from './lib/csrf';
import { getToken } from 'next-auth/jwt';
import { SECURITY_CONFIG } from './lib/security-config';
import { getRedisClient } from './lib/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Rate limiting storage (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMITS = {
  api: { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  auth: { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes (brute-force protection)
  general: { requests: 300, window: 60 * 1000 }, // 300 requests per minute
};

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  // Note: request.ip is not available in Next.js 15, use alternative methods
  const clientIP = forwarded?.split(',')[0]?.trim() || real || '127.0.0.1';
  return clientIP;
}

// Upstash Ratelimit instances keyed by "requests:windowMs"
const ratelimitInstances = new Map<string, Ratelimit>();

function getUpstashRatelimit(limit: { requests: number; window: number }): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const cacheKey = `${limit.requests}:${limit.window}`;
  let instance = ratelimitInstances.get(cacheKey);
  if (instance) return instance;

  // Upstash slidingWindow expects duration as a formatted string (e.g. "60 s")
  const windowSeconds = Math.ceil(limit.window / 1000);
  instance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit.requests, `${windowSeconds} s`),
    prefix: 'ratelimit:middleware',
  });

  ratelimitInstances.set(cacheKey, instance);
  return instance;
}

// Rate limiting result type
type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp in seconds
};

// Rate limiting function — uses Upstash Redis when available, falls back to in-memory Map
async function rateLimit(
  request: NextRequest,
  limitConfig: { requests: number; window: number }
): Promise<RateLimitResult> {
  const clientIP = getClientIP(request);
  const key = `${clientIP}:${request.nextUrl.pathname}`;

  // --- Try Upstash Redis first ---
  const upstash = getUpstashRatelimit(limitConfig);
  if (upstash) {
    try {
      const { success, remaining, reset } = await upstash.limit(key);
      return {
        allowed: success,
        remaining,
        limit: limitConfig.requests,
        reset: Math.ceil(reset / 1000), // convert ms → seconds
      };
    } catch (error) {
      // Redis network / timeout error — fall through to in-memory fallback
      console.warn('[RateLimit] Upstash Redis error, falling back to in-memory:', error);
    }
  }

  // --- In-memory fallback ---
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    const resetTime = now + limitConfig.window;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: limitConfig.requests - 1,
      limit: limitConfig.requests,
      reset: Math.ceil(resetTime / 1000),
    };
  }

  if (record.count >= limitConfig.requests) {
    return {
      allowed: false,
      remaining: 0,
      limit: limitConfig.requests,
      reset: Math.ceil(record.resetTime / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limitConfig.requests - record.count,
    limit: limitConfig.requests,
    reset: Math.ceil(record.resetTime / 1000),
  };
}

// Note: CSRF validation functions now imported from lib/csrf.ts

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;
  
  // HTTPS enforcement in production
  // Only trust x-forwarded-proto when request comes through Cloudflare (cf-ray header present)
  const isFromTrustedProxy = !!request.headers.get('cf-ray');
  if (process.env.NODE_ENV === 'production' && isFromTrustedProxy && request.headers.get('x-forwarded-proto') !== 'https') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl);
  }

  // Admin auto-redirect: Redirect admin users from user-facing pages to /admin
  // This prevents admins from seeing irrelevant signup/profile completion modals
  const userFacingPages = ['/', '/search', '/parent-dashboard', '/caregiver-dashboard', '/messages', '/profile', '/settings', '/bookings'];
  const isUserFacingPage = userFacingPages.includes(pathname) || pathname.startsWith('/caregiver/');

  if (isUserFacingPage) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
      });

      // If user is authenticated as ADMIN or SUPERVISOR, redirect to admin dashboard
      if (token && (token.userType === 'ADMIN' || token.userType === 'SUPERVISOR')) {
        const adminUrl = new URL('/admin', request.url);
        return NextResponse.redirect(adminUrl);
      }
    } catch (error) {
      // If token parsing fails, continue normally (user might not be logged in)
      console.error('Error checking admin token in middleware:', error);
    }
  }

  // Force password change redirect for users with mustChangePassword flag
  if (!pathname.startsWith('/change-password') && !pathname.startsWith('/api/change-password') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/_next') && !pathname.startsWith('/favicon')) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
      });

      if (token && token.mustChangePassword === true) {
        const changePasswordUrl = new URL('/change-password', request.url);
        return NextResponse.redirect(changePasswordUrl);
      }
    } catch (error) {
      // If token parsing fails, continue normally
    }
  }

  // =========================================================================
  // Security Headers (defense-in-depth: set here AND in nginx)
  // =========================================================================
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', SECURITY_CONFIG.HEADERS.HSTS);
    response.headers.set('Content-Security-Policy', SECURITY_CONFIG.HEADERS.CSP);
  } else {
    // Development CSP (more permissive for hot reload, etc.)
    const devCspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https: data:",
      "connect-src 'self' ws: wss:",
      "frame-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
    ].join('; ');
    response.headers.set('Content-Security-Policy', devCspHeader);
  }
  
  // Rate limiting
  let rateLimitConfig = RATE_LIMITS.general;
  
  // Apply stricter rate limits to API routes
  if (pathname.startsWith('/api/')) {
    rateLimitConfig = RATE_LIMITS.api;
    
    // Even stricter limits for authentication endpoints
    if (pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/reset-password') || pathname.includes('/check-email')) {
      rateLimitConfig = RATE_LIMITS.auth;
    }
  }
  
  const rateLimitResult = await rateLimit(request, rateLimitConfig);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(rateLimitConfig.window / 1000).toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        }
      }
    );
  }
  
  // CSRF protection for state-changing requests
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    // Only these endpoints skip CSRF validation (justified external/auth endpoints):
    // All other API endpoints are CSRF-protected via double-submit cookie pattern.

    const skipCSRFPrefixes = [
      '/api/auth',           // NextAuth handles CSRF internally
      '/api/csrf-token',     // Used to get the CSRF token itself
      '/api/webhook',        // External webhooks (Stripe, Twilio, etc.)
      '/api/stripe/webhook', // Stripe webhooks specifically
      '/api/cron',           // Server-side cron jobs
    ];

    const shouldSkipCSRF = skipCSRFPrefixes.some(
      prefix => pathname === prefix || pathname.startsWith(prefix + '/')
    );

    if (!shouldSkipCSRF) {
      const csrfResult = await verifyCSRFProtection(request);
      if (!csrfResult.isValid) {
        // Log CSRF failures for security monitoring
        console.warn('[SECURITY] CSRF validation failed:', {
          path: pathname,
          method: request.method,
          error: csrfResult.error,
          ip: getClientIP(request),
        });
        return NextResponse.json(
          { error: csrfResult.error || 'Invalid or missing CSRF token.' },
          { status: 403 }
        );
      }
    }
  }
  
  // Set CSRF token for GET requests
  if (request.method === 'GET' && !request.cookies.get('csrf-token')) {
    await setCSRFToken(response);
  }
  
  // Add rate limiting info headers to the response
  response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};