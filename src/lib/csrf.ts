import { NextRequest, NextResponse } from 'next/server';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || '';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Only enforce secret requirement on the server side — client-side code only
// reads tokens from cookies and doesn't need the secret
if (typeof window === 'undefined' && !CSRF_SECRET && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('CRITICAL: CSRF_SECRET or JWT_SECRET environment variable must be set');
}

/**
 * Generate cryptographically secure random bytes (Edge-compatible)
 */
function getRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create HMAC-SHA256 using Web Crypto API (Edge-compatible)
 */
async function createHmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Constant-time string comparison (Edge-compatible, no Node.js crypto needed)
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a cryptographically secure CSRF token
 */
export async function generateCSRFToken(sessionId?: string): Promise<string> {
  const timestamp = Date.now().toString();
  const randomBytes = getRandomBytes(16);
  const random = bytesToHex(randomBytes);
  const data = `${timestamp}:${random}:${sessionId || 'anonymous'}`;

  const signature = await createHmacSha256(CSRF_SECRET, data);

  const token = `${btoa(data)}.${signature}`;
  return token;
}

/**
 * Validate a CSRF token
 */
export async function validateCSRFToken(token: string, sessionId?: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedData, signature] = parts;

  try {
    const data = atob(encodedData);
    const [timestamp, , tokenSessionId] = data.split(':');

    const expectedSignature = await createHmacSha256(CSRF_SECRET, data);

    if (!timingSafeCompare(signature, expectedSignature)) {
      return false;
    }

    // Check if session IDs match (if provided)
    if (sessionId && tokenSessionId !== sessionId && tokenSessionId !== 'anonymous') {
      return false;
    }

    // Check token age (valid for 24 hours)
    const tokenTime = parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (Date.now() - tokenTime > maxAge) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract CSRF token from request
 */
export function extractCSRFToken(request: NextRequest): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;

  return null;
}

/**
 * Set CSRF token in response
 */
export async function setCSRFToken(response: NextResponse, token?: string, sessionId?: string): Promise<void> {
  const csrfToken = token || await generateCSRFToken(sessionId);

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Needs to be accessible to JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    path: '/',
  });

  // Also set it as a header for immediate use
  response.headers.set('X-CSRF-Token', csrfToken);
}

/**
 * Verify CSRF protection for a request
 */
export async function verifyCSRFProtection(request: NextRequest, sessionId?: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  const method = request.method.toUpperCase();

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { isValid: true };
  }

  const rawCookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const rawHeaderToken = extractCSRFToken(request);

  if (!rawCookieToken) {
    return {
      isValid: false,
      error: 'CSRF token missing from cookies. Please refresh the page.'
    };
  }

  if (!rawHeaderToken) {
    return {
      isValid: false,
      error: 'CSRF token missing from request headers.'
    };
  }

  // URL decode both tokens to ensure consistent comparison
  const cookieToken = decodeURIComponent(rawCookieToken);
  const headerToken = decodeURIComponent(rawHeaderToken);

  if (cookieToken !== headerToken) {
    console.error('CSRF Token Mismatch:', {
      method: request.method,
      path: request.nextUrl.pathname,
    });

    return {
      isValid: false,
      error: 'CSRF token mismatch between cookie and header.'
    };
  }

  if (!await validateCSRFToken(cookieToken, sessionId)) {
    return {
      isValid: false,
      error: 'Invalid or expired CSRF token. Please refresh the page.'
    };
  }

  return { isValid: true };
}

/**
 * Create CSRF protection middleware for API routes
 */
export function createCSRFMiddleware(options: {
  skipPaths?: string[];
  sessionIdExtractor?: (request: NextRequest) => string | undefined;
} = {}) {
  const { skipPaths = [], sessionIdExtractor } = options;

  return (request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

    // Skip CSRF for specified paths
    if (skipPaths.some(path => pathname.startsWith(path))) {
      return { bypass: true };
    }

    const sessionId = sessionIdExtractor ? sessionIdExtractor(request) : undefined;
    return verifyCSRFProtection(request, sessionId);
  };
}

/**
 * Helper to add CSRF token to fetch requests
 */
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  if (typeof window !== 'undefined') {
    // Get CSRF token from cookie on client side
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
      ?.split('=')[1];

    if (csrfToken) {
      return {
        ...headers,
        [CSRF_HEADER_NAME]: csrfToken,
      };
    }
  }

  return headers;
}

/**
 * React hook to get CSRF token
 */
export function useCSRFToken(): string | null {
  if (typeof window === 'undefined') return null;

  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split('=')[1] || null;
}

/**
 * Get CSRF token from cookie (client-side helper)
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof window === 'undefined') return null;

  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split('=')[1] || null;
}
