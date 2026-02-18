import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getToken before importing middleware
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/csrf', () => ({
  verifyCSRFProtection: vi.fn().mockResolvedValue({ isValid: true }),
  setCSRFToken: vi.fn(),
}));

vi.mock('@/lib/security-config', () => ({
  SECURITY_CONFIG: {
    HEADERS: {
      CSP: "default-src 'self'; script-src 'self'",
      HSTS: 'max-age=31536000; includeSubDomains; preload',
    },
  },
}));

describe('Middleware security headers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sets core security headers on every response', async () => {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest('http://localhost:3005/some-page', {
      method: 'GET',
    });
    // Simulate having a csrf cookie so setCSRFToken isn't called
    req.cookies.set('csrf-token', 'test-token');

    const res = await middleware(req);

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('on');
  });

  it('sets CSP header in development (permissive)', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';

    const { middleware } = await import('@/middleware');
    const req = new NextRequest('http://localhost:3005/page');
    req.cookies.set('csrf-token', 'test');

    const res = await middleware(req);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");

    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('sets HSTS and strict CSP in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { middleware } = await import('@/middleware');
    const req = new NextRequest('http://localhost:3005/page');
    req.cookies.set('csrf-token', 'test');

    const res = await middleware(req);
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");

    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 429 when rate limited', async () => {
    const { middleware } = await import('@/middleware');

    // Flood with requests to trigger rate limit
    let lastRes;
    for (let i = 0; i < 310; i++) {
      const req = new NextRequest('http://localhost:3005/some-page');
      req.cookies.set('csrf-token', 'test');
      lastRes = await middleware(req);
    }

    expect(lastRes!.status).toBe(429);
    const body = await lastRes!.json();
    expect(body.error).toContain('Too many requests');
  });
});
