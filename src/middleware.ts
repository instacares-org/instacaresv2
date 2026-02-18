import { NextRequest, NextResponse } from 'next/server';
import { verifyCSRFProtection, setCSRFToken } from './lib/csrf';
import { getToken } from 'next-auth/jwt';
import { SECURITY_CONFIG } from './lib/security-config';

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

// Rate limiting function
function rateLimit(request: NextRequest, limit: { requests: number; window: number }): boolean {
  const clientIP = getClientIP(request);
  const key = `${clientIP}:${request.nextUrl.pathname}`;
  const now = Date.now();
  
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.window });
    return true;
  }
  
  if (record.count >= limit.requests) {
    return false; // Rate limit exceeded
  }
  
  record.count += 1;
  return true;
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
        secret: process.env.NEXTAUTH_SECRET
      });

      // If user is authenticated as ADMIN, redirect to admin dashboard
      if (token && token.userType === 'ADMIN') {
        const adminUrl = new URL('/admin', request.url);
        return NextResponse.redirect(adminUrl);
      }
    } catch (error) {
      // If token parsing fails, continue normally (user might not be logged in)
      console.error('Error checking admin token in middleware:', error);
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
  
  if (!rateLimit(request, rateLimitConfig)) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(rateLimitConfig.window / 1000).toString(),
          'X-RateLimit-Limit': rateLimitConfig.requests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil((Date.now() + rateLimitConfig.window) / 1000).toString(),
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
  
  // Add security headers for rate limiting info
  const clientIP = getClientIP(request);
  const key = `${clientIP}:${pathname}`;
  const record = rateLimitStore.get(key);
  
  if (record) {
    response.headers.set('X-RateLimit-Limit', rateLimitConfig.requests.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimitConfig.requests - record.count).toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
  }
  
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