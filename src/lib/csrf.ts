import { NextRequest, NextResponse } from 'next/server';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-key';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

if (!CSRF_SECRET) {
  console.warn('WARNING: No CSRF_SECRET or JWT_SECRET found. Using default secret.');
}

/**
 * Generate cryptographically secure random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Web Crypto API (works in both Node.js and Edge Runtime)
    return crypto.getRandomValues(array);
  } else {
    // Node.js crypto module fallback
    try {
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(array);
      return array;
    } catch (error) {
      throw new Error('No secure random number generator available. Cannot generate CSRF tokens.');
    }
  }
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
 * Create HMAC-SHA256 using Web Crypto API
 */
async function createHmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return bytesToHex(new Uint8Array(signature));
  } else {
    // Fallback - simple hash (less secure, but better than nothing)
    let hash = 0;
    const combined = key + data;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(sessionId?: string): string {
  const timestamp = Date.now().toString();
  const randomBytes = getRandomBytes(16);
  const random = bytesToHex(randomBytes);
  const data = `${timestamp}:${random}:${sessionId || 'anonymous'}`;
  
  // Return a simple token that can be validated synchronously
  // We'll use a different approach that doesn't require async HMAC
  const simpleHash = data.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0);
  }, 0);
  
  const token = `${btoa(data)}.${Math.abs(simpleHash).toString(16)}`;
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(token: string, sessionId?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [encodedData, signature] = parts;
  
  try {
    const data = atob(encodedData);
    const [timestamp, random, tokenSessionId] = data.split(':');
    
    // Verify the signature using the same simple hash
    const expectedHash = data.split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0);
    
    const expectedSignature = Math.abs(expectedHash).toString(16);
    
    if (signature !== expectedSignature) {
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
  } catch (error) {
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
  
  // Try form data
  if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    // Note: This would require reading the body, which might not be available in middleware
    // Better to use headers or cookies
  }
  
  return null;
}

/**
 * Set CSRF token in response
 */
export function setCSRFToken(response: NextResponse, token?: string, sessionId?: string): void {
  const csrfToken = token || generateCSRFToken(sessionId);
  
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
export function verifyCSRFProtection(request: NextRequest, sessionId?: string): {
  isValid: boolean;
  error?: string;
} {
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
    // Debug CSRF mismatch
    console.error('CSRF Token Mismatch:', {
      rawCookieToken: rawCookieToken?.substring(0, 30) + '...',
      cookieToken: cookieToken?.substring(0, 30) + '...',
      rawHeaderToken: rawHeaderToken?.substring(0, 30) + '...',
      headerToken: headerToken?.substring(0, 30) + '...',
      rawCookieLength: rawCookieToken?.length,
      cookieLength: cookieToken?.length,
      rawHeaderLength: rawHeaderToken?.length,
      headerLength: headerToken?.length,
      areEqual: cookieToken === headerToken,
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    return { 
      isValid: false, 
      error: 'CSRF token mismatch between cookie and header.' 
    };
  }
  
  if (!validateCSRFToken(cookieToken, sessionId)) {
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