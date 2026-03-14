import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Unmock rate-limit so we test the real implementation (setup.ts mocks it globally)
vi.unmock('@/lib/rate-limit');

// Mock Redis as unavailable so in-memory fallback is exercised
vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

describe('Rate Limiting', () => {
  let checkRateLimit: typeof import('@/lib/rate-limit').checkRateLimit;
  let checkUserRateLimit: typeof import('@/lib/rate-limit').checkUserRateLimit;
  let getClientIP: typeof import('@/lib/rate-limit').getClientIP;
  let defaultKeyGenerator: typeof import('@/lib/rate-limit').defaultKeyGenerator;
  let createRateLimitHeaders: typeof import('@/lib/rate-limit').createRateLimitHeaders;
  let createRateLimitMiddleware: typeof import('@/lib/rate-limit').createRateLimitMiddleware;
  let cleanupRateLimitStore: typeof import('@/lib/rate-limit').cleanupRateLimitStore;
  let RATE_LIMIT_CONFIGS: typeof import('@/lib/rate-limit').RATE_LIMIT_CONFIGS;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
    checkUserRateLimit = mod.checkUserRateLimit;
    getClientIP = mod.getClientIP;
    defaultKeyGenerator = mod.defaultKeyGenerator;
    createRateLimitHeaders = mod.createRateLimitHeaders;
    createRateLimitMiddleware = mod.createRateLimitMiddleware;
    cleanupRateLimitStore = mod.cleanupRateLimitStore;
    RATE_LIMIT_CONFIGS = mod.RATE_LIMIT_CONFIGS;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeRequest(
    path = '/api/test',
    headers: Record<string, string> = {}
  ): NextRequest {
    const url = `http://localhost:3000${path}`;
    return new NextRequest(url, { method: 'GET', headers });
  }

  it('allows requests within the configured limit', async () => {
    const config = { requests: 5, window: 60_000 };
    const req = makeRequest();

    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(req, config);
      expect(result.success).toBe(true);
    }
  });

  it('returns correct remaining count as requests are made', async () => {
    const config = { requests: 3, window: 60_000 };
    const req = makeRequest();

    const r1 = await checkRateLimit(req, config);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(req, config);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(req, config);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests once the limit is exceeded', async () => {
    const config = { requests: 3, window: 60_000 };
    const req = makeRequest();

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(req, config);
    }

    const blocked = await checkRateLimit(req, config);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeDefined();
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('does not increment count when request is blocked', async () => {
    const config = { requests: 2, window: 60_000 };
    const req = makeRequest();

    await checkRateLimit(req, config);
    await checkRateLimit(req, config);

    const b1 = await checkRateLimit(req, config);
    const b2 = await checkRateLimit(req, config);
    expect(b1.success).toBe(false);
    expect(b2.success).toBe(false);
    expect(b1.remaining).toBe(0);
    expect(b2.remaining).toBe(0);
  });

  it('resets the counter after the time window elapses', async () => {
    const config = { requests: 2, window: 60_000 };
    const req = makeRequest();

    await checkRateLimit(req, config);
    await checkRateLimit(req, config);
    const blocked = await checkRateLimit(req, config);
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(61_000);

    const afterReset = await checkRateLimit(req, config);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('RATE_LIMIT_CONFIGS defines distinct tiers with increasing leniency', () => {
    expect(RATE_LIMIT_CONFIGS.LOGIN.requests).toBeLessThanOrEqual(
      RATE_LIMIT_CONFIGS.API_READ.requests
    );
    expect(RATE_LIMIT_CONFIGS.SIGNUP.requests).toBeLessThan(
      RATE_LIMIT_CONFIGS.GENERAL.requests
    );
    expect(RATE_LIMIT_CONFIGS.GENERAL.requests).toBe(300);
    expect(RATE_LIMIT_CONFIGS.GENERAL.window).toBe(60_000);
  });

  it('applies different configs independently per endpoint', async () => {
    const strictConfig = { requests: 2, window: 60_000 };
    const lenientConfig = { requests: 100, window: 60_000 };

    const strictReq = makeRequest('/api/auth/login');
    const lenientReq = makeRequest('/api/caregivers');

    await checkRateLimit(strictReq, strictConfig);
    await checkRateLimit(strictReq, strictConfig);
    const strictBlocked = await checkRateLimit(strictReq, strictConfig);
    expect(strictBlocked.success).toBe(false);

    const lenientResult = await checkRateLimit(lenientReq, lenientConfig);
    expect(lenientResult.success).toBe(true);
  });

  it('extracts IP from cf-connecting-ip header (Cloudflare)', () => {
    const req = makeRequest('/api/test', { 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('extracts IP from x-real-ip header', () => {
    const req = makeRequest('/api/test', { 'x-real-ip': '5.6.7.8' });
    expect(getClientIP(req)).toBe('5.6.7.8');
  });

  it('extracts first IP from x-forwarded-for header', () => {
    const req = makeRequest('/api/test', {
      'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3',
    });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('falls back to 127.0.0.1 when no IP headers are present', () => {
    const req = makeRequest('/api/test');
    expect(getClientIP(req)).toBe('127.0.0.1');
  });

  it('tracks different IPs independently', async () => {
    const config = { requests: 1, window: 60_000 };
    const req1 = makeRequest('/api/test', { 'x-real-ip': '1.1.1.1' });
    const req2 = makeRequest('/api/test', { 'x-real-ip': '2.2.2.2' });

    await checkRateLimit(req1, config);
    const blocked1 = await checkRateLimit(req1, config);
    expect(blocked1.success).toBe(false);

    const result2 = await checkRateLimit(req2, config);
    expect(result2.success).toBe(true);
  });

  it('generates key combining IP and pathname', () => {
    const req = makeRequest('/api/bookings', { 'x-real-ip': '9.9.9.9' });
    const key = defaultKeyGenerator(req);
    expect(key).toBe('9.9.9.9:/api/bookings');
  });

  it('checkUserRateLimit tracks by userId + endpoint', async () => {
    const config = { requests: 2, window: 60_000 };

    const r1 = await checkUserRateLimit('user-A', '/api/bookings', config);
    expect(r1.success).toBe(true);

    const r2 = await checkUserRateLimit('user-A', '/api/bookings', config);
    expect(r2.success).toBe(true);

    const blocked = await checkUserRateLimit('user-A', '/api/bookings', config);
    expect(blocked.success).toBe(false);

    const otherUser = await checkUserRateLimit('user-B', '/api/bookings', config);
    expect(otherUser.success).toBe(true);
  });

  it('createRateLimitHeaders produces correct header map', () => {
    const headers = createRateLimitHeaders({
      success: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
    });
    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('95');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('createRateLimitHeaders includes Retry-After when present', () => {
    const headers = createRateLimitHeaders({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 42,
    });
    expect(headers['Retry-After']).toBe('42');
  });

  it('createRateLimitMiddleware returns a function that checks limits', async () => {
    const mw = createRateLimitMiddleware({ requests: 1, window: 60_000 });
    const req = makeRequest('/api/thing');

    const r1 = await mw(req);
    expect(r1.success).toBe(true);

    const r2 = await mw(req);
    expect(r2.success).toBe(false);
  });

  it('cleanupRateLimitStore removes expired entries', async () => {
    const config = { requests: 5, window: 10_000 };
    const req = makeRequest();
    await checkRateLimit(req, config);

    vi.advanceTimersByTime(15_000);
    cleanupRateLimitStore();

    const result = await checkRateLimit(req, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
