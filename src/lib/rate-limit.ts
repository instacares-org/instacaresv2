import { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from './redis';

// In-memory fallback store (used when Redis is unavailable)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  requests: number;    // Number of requests allowed
  window: number;      // Time window in milliseconds
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean;     // Skip counting failed requests
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Very strict for authentication
  LOGIN: { requests: 20, window: 15 * 60 * 1000 }, // 20 attempts per 15 minutes
  SIGNUP: { requests: 3, window: 60 * 60 * 1000 }, // 3 signups per hour
  PASSWORD_RESET: { requests: 3, window: 60 * 60 * 1000 }, // 3 resets per hour

  // Moderate for sensitive operations
  BOOKING: { requests: 10, window: 5 * 60 * 1000 }, // 10 bookings per 5 minutes
  PAYMENT: { requests: 5, window: 10 * 60 * 1000 }, // 5 payments per 10 minutes
  PROFILE_UPDATE: { requests: 10, window: 15 * 60 * 1000 }, // 10 updates per 15 minutes

  // Lenient for general API usage
  API_READ: { requests: 100, window: 60 * 1000 }, // 100 reads per minute
  API_WRITE: { requests: 30, window: 60 * 1000 }, // 30 writes per minute

  // General web traffic
  GENERAL: { requests: 300, window: 60 * 1000 }, // 300 requests per minute
} as const;

// Cache Ratelimit instances per config to avoid creating new ones on every call
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const cacheKey = `${config.requests}:${config.window}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, `${config.window} ms`),
    prefix: 'rl',
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (cfConnectingIP) return cfConnectingIP;
  if (xRealIP) return xRealIP;
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  return '127.0.0.1';
}

// Default key generator using IP and endpoint
export function defaultKeyGenerator(request: NextRequest): string {
  const ip = getClientIP(request);
  const endpoint = request.nextUrl.pathname;
  return `${ip}:${endpoint}`;
}

// In-memory fallback for rate limiting
function checkRateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now >= record.resetTime) {
    record = { count: 0, resetTime: now + config.window };
    rateLimitStore.set(key, record);
  }

  const remaining = Math.max(0, config.requests - record.count);
  const success = record.count < config.requests;

  if (success) {
    record.count += 1;
  }

  return {
    success,
    limit: config.requests,
    remaining: success ? remaining - 1 : remaining,
    reset: Math.ceil(record.resetTime / 1000),
    retryAfter: success ? undefined : Math.ceil((record.resetTime - now) / 1000),
  };
}

// Check rate limit for a request (Redis-backed with in-memory fallback)
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const keyGen = config.keyGenerator || defaultKeyGenerator;
  const key = keyGen(request);

  const limiter = getLimiter(config);
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      const now = Date.now();
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.ceil(result.reset / 1000),
        retryAfter: result.success ? undefined : Math.ceil((result.reset - now) / 1000),
      };
    } catch {
      // Redis error — fall back to in-memory
      return checkRateLimitInMemory(key, config);
    }
  }

  return checkRateLimitInMemory(key, config);
}

// User-specific rate limiting (Redis-backed with in-memory fallback)
export async function checkUserRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `user:${userId}:${endpoint}`;

  const limiter = getLimiter(config);
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      const now = Date.now();
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.ceil(result.reset / 1000),
        retryAfter: result.success ? undefined : Math.ceil((result.reset - now) / 1000),
      };
    } catch {
      // Redis error — fall back to in-memory
      return checkRateLimitInMemory(key, config);
    }
  }

  return checkRateLimitInMemory(key, config);
}

// Cleanup old entries (no-op when Redis is available — Redis handles TTL)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Periodic cleanup (only needed for in-memory fallback)
let cleanupInterval: NodeJS.Timeout | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Helper function to create rate limit response headers
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

// Middleware helper for rate limiting
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: NextRequest) => {
    return checkRateLimit(request, config);
  };
}
