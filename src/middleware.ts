import { NextRequest, NextResponse } from 'next/server';
import { verifyCSRFProtection, generateCSRFToken, setCSRFToken } from './lib/csrf';

// Rate limiting storage (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMITS = {
  api: { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  auth: { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  general: { requests: 300, window: 60 * 1000 }, // 300 requests per minute
};

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const clientIP = forwarded?.split(',')[0]?.trim() || real || request.ip || 'unknown';
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

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;
  
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production' && request.headers.get('x-forwarded-proto') !== 'https') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl);
  }
  
  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self "https://*.mapbox.com")');
  
  // HSTS (HTTP Strict Transport Security) in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https:",
    "connect-src 'self' https://api.stripe.com https://api.mapbox.com wss: ws:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', cspHeader);
  
  // Rate limiting
  let rateLimitConfig = RATE_LIMITS.general;
  
  // Apply stricter rate limits to API routes
  if (pathname.startsWith('/api/')) {
    rateLimitConfig = RATE_LIMITS.api;
    
    // Even stricter limits for authentication endpoints
    if (pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/reset-password')) {
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
    // Skip CSRF for authentication endpoints and public APIs (they handle their own security)
    const skipCSRFPaths = ['/api/auth/', '/api/login', '/api/signup', '/api/webhook', '/api/csrf-token', '/api/geocode'];
    const shouldSkipCSRF = skipCSRFPaths.some(path => pathname.startsWith(path));
    
    if (!shouldSkipCSRF) {
      const csrfResult = verifyCSRFProtection(request);
      if (!csrfResult.isValid) {
        return NextResponse.json(
          { error: csrfResult.error || 'Invalid or missing CSRF token.' },
          { status: 403 }
        );
      }
    }
  }
  
  // Set CSRF token for GET requests
  if (request.method === 'GET' && !request.cookies.get('csrf-token')) {
    const csrfToken = generateCSRFToken();
    setCSRFToken(response, csrfToken);
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