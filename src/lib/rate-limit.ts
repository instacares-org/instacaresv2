import { NextRequest } from 'next/server';

// In-memory store for rate limiting (use Redis in production)
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
  LOGIN: { requests: 20, window: 15 * 60 * 1000 }, // 20 attempts per 15 minutes (increased for testing)
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

// Get client IP address
export function getClientIP(request: NextRequest): string {
  // Check for IP from load balancer/proxy
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (xRealIP) return xRealIP;
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Note: request.ip is not available in Next.js 15
  return '127.0.0.1';
}

// Default key generator using IP and endpoint
export function defaultKeyGenerator(request: NextRequest): string {
  const ip = getClientIP(request);
  const endpoint = request.nextUrl.pathname;
  return `${ip}:${endpoint}`;
}

// Check rate limit for a request
export function checkRateLimit(
  request: NextRequest, 
  config: RateLimitConfig
): RateLimitResult {
  const keyGen = config.keyGenerator || defaultKeyGenerator;
  const key = keyGen(request);
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  // Clean up or reset if window has passed
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

// User-specific rate limiting (requires authentication)
export function checkUserRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `user:${userId}:${endpoint}`;
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

// Cleanup old entries periodically
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Set up periodic cleanup (call this once in your app)
let cleanupInterval: NodeJS.Timeout | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return; // Already started
  
  // Clean up every 5 minutes
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