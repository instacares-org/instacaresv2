/**
 * Centralized Security Configuration
 * All security-related constants and configurations
 */

export const SECURITY_CONFIG = {
  // JWT Configuration
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m', // Short-lived access tokens
    REFRESH_TOKEN_EXPIRY: '7d', // Longer refresh tokens
    ISSUER: 'instacares',
    AUDIENCE: 'instacares-users',
  },

  // Session Configuration
  SESSION: {
    MAX_AGE: 7 * 24 * 60 * 60, // 7 days in seconds
    UPDATE_AGE: 24 * 60 * 60, // Extend if active within 24 hours
    IDLE_TIMEOUT: 30 * 60, // 30 minutes of inactivity
  },

  // Cookie Configuration
  COOKIES: {
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: true,
    SECURE_IN_PRODUCTION: true,
  },

  // Rate Limiting
  RATE_LIMITS: {
    AUTH_ENDPOINTS: {
      REQUESTS: 5,
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    },
    API_ENDPOINTS: {
      REQUESTS: 100,
      WINDOW_MS: 60 * 1000, // 1 minute
    },
    GENERAL: {
      REQUESTS: 300,
      WINDOW_MS: 60 * 1000, // 1 minute
    },
  },

  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  },

  // Security Headers
  HEADERS: {
    CSP: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https:",
      "connect-src 'self' https://api.stripe.com https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com wss: ws:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
    HSTS: 'max-age=31536000; includeSubDomains; preload',
  },

  // Allowed origins for CORS
  CORS: {
    ORIGINS: process.env.NODE_ENV === 'production' 
      ? ['https://instacares.net', 'https://www.instacares.net']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  },

  // Validation
  VALIDATION: {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^\+?[\d\s\-\(\)]{10,}$/,
    SANITIZE_HTML: true,
  },
} as const;

/**
 * Environment-specific security checks
 */
export function validateSecurityEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required environment variables
  if (!process.env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET is required');
  }

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  }

  // Validate secret strength in production
  if (process.env.NODE_ENV === 'production') {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    if (nextAuthSecret && nextAuthSecret.length < 32) {
      errors.push('NEXTAUTH_SECRET must be at least 32 characters in production');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }

    // Check for common weak secrets
    const weakSecrets = ['secret', 'test', 'development', '123456'];
    if (nextAuthSecret && weakSecrets.some(weak => nextAuthSecret.toLowerCase().includes(weak))) {
      errors.push('NEXTAUTH_SECRET appears to be weak or contain common patterns');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate secure random string for secrets
 */
export function generateSecureSecret(length: number = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Input sanitization helper
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .substring(0, 1000); // Prevent extremely long inputs
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return SECURITY_CONFIG.VALIDATION.EMAIL_REGEX.test(email);
}

/**
 * Security audit log helper
 */
export function logSecurityEvent(event: string, details: any = {}) {
  if (process.env.NODE_ENV === 'production') {
    // In production, you might want to send this to a security monitoring service
    console.warn('[SECURITY]', event, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}