import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Security Configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // Helper to import the module fresh (needed because CORS config reads
  // process.env.NODE_ENV at module evaluation time).
  async function importModule() {
    return import('@/lib/security-config');
  }

  // ------- CSP Header -------

  describe('CSP header generation', () => {
    it('contains all required CSP directives', async () => {
      const { SECURITY_CONFIG } = await importModule();
      const csp = SECURITY_CONFIG.HEADERS.CSP;

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('img-src');
      expect(csp).toContain('font-src');
      expect(csp).toContain('connect-src');
      expect(csp).toContain('frame-src');
      expect(csp).toContain('worker-src');
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('allows Stripe scripts in CSP', async () => {
      const { SECURITY_CONFIG } = await importModule();
      const csp = SECURITY_CONFIG.HEADERS.CSP;

      expect(csp).toContain('https://js.stripe.com');
      expect(csp).toContain('https://api.stripe.com');
      expect(csp).toContain('https://hooks.stripe.com');
    });

    it('allows Mapbox resources in CSP', async () => {
      const { SECURITY_CONFIG } = await importModule();
      const csp = SECURITY_CONFIG.HEADERS.CSP;

      expect(csp).toContain('https://api.mapbox.com');
      expect(csp).toContain('https://*.tiles.mapbox.com');
      expect(csp).toContain('https://events.mapbox.com');
    });

    it('blocks object embeds and restricts frame ancestors', async () => {
      const { SECURITY_CONFIG } = await importModule();
      const csp = SECURITY_CONFIG.HEADERS.CSP;

      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('CSP directives are semicolon-delimited', async () => {
      const { SECURITY_CONFIG } = await importModule();
      const directives = SECURITY_CONFIG.HEADERS.CSP.split('; ');
      // There should be many directives separated by '; '
      expect(directives.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ------- HSTS -------

  describe('HSTS configuration', () => {
    it('sets max-age to one year (31536000)', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.HEADERS.HSTS).toContain('max-age=31536000');
    });

    it('includes includeSubDomains directive', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.HEADERS.HSTS).toContain('includeSubDomains');
    });

    it('includes preload directive', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.HEADERS.HSTS).toContain('preload');
    });

    it('matches full expected HSTS value', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.HEADERS.HSTS).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });
  });

  // ------- CORS -------

  describe('CORS configuration', () => {
    it('allows production origins when NODE_ENV is production', async () => {
      // @ts-ignore - override readonly
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { SECURITY_CONFIG } = await importModule();

      expect(SECURITY_CONFIG.CORS.ORIGINS).toContain('https://instacares.com');
      expect(SECURITY_CONFIG.CORS.ORIGINS).toContain('https://www.instacares.com');
      expect(SECURITY_CONFIG.CORS.ORIGINS).not.toContain('http://localhost:3000');
    });

    it('allows localhost origins when NODE_ENV is not production', async () => {
      // @ts-ignore
      process.env.NODE_ENV = 'development';
      vi.resetModules();
      const { SECURITY_CONFIG } = await importModule();

      expect(SECURITY_CONFIG.CORS.ORIGINS).toContain('http://localhost:3000');
      expect(SECURITY_CONFIG.CORS.ORIGINS).toContain('http://127.0.0.1:3000');
      expect(SECURITY_CONFIG.CORS.ORIGINS).not.toContain('https://instacares.com');
    });
  });

  // ------- Cookie / Session / JWT constants -------

  describe('Security constant values', () => {
    it('JWT access token has short expiry', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY).toBe('15m');
    });

    it('session max age is 7 days', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.SESSION.MAX_AGE).toBe(7 * 24 * 60 * 60);
    });

    it('cookies are configured securely', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.COOKIES.SAME_SITE).toBe('strict');
      expect(SECURITY_CONFIG.COOKIES.HTTP_ONLY).toBe(true);
      expect(SECURITY_CONFIG.COOKIES.SECURE_IN_PRODUCTION).toBe(true);
    });

    it('password policy enforces strong passwords', async () => {
      const { SECURITY_CONFIG } = await importModule();
      expect(SECURITY_CONFIG.PASSWORD.MIN_LENGTH).toBeGreaterThanOrEqual(8);
      expect(SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE).toBe(true);
      expect(SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE).toBe(true);
      expect(SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS).toBe(true);
      expect(SECURITY_CONFIG.PASSWORD.REQUIRE_SYMBOLS).toBe(true);
    });
  });

  // ------- validateSecurityEnvironment -------

  describe('validateSecurityEnvironment()', () => {
    it('returns errors when required secrets are missing', async () => {
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.JWT_SECRET;
      vi.resetModules();

      const { validateSecurityEnvironment } = await importModule();
      const result = validateSecurityEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NEXTAUTH_SECRET is required');
      expect(result.errors).toContain('JWT_SECRET is required');
    });

    it('returns valid when all required secrets are present (non-production)', async () => {
      process.env.NEXTAUTH_SECRET = 'some-secret';
      process.env.JWT_SECRET = 'some-jwt-secret';
      // @ts-ignore
      process.env.NODE_ENV = 'test';
      vi.resetModules();

      const { validateSecurityEnvironment } = await importModule();
      const result = validateSecurityEnvironment();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects short secrets in production', async () => {
      process.env.NEXTAUTH_SECRET = 'short';
      process.env.JWT_SECRET = 'short';
      // @ts-ignore
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      const { validateSecurityEnvironment } = await importModule();
      const result = validateSecurityEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('at least 32 characters'))).toBe(true);
    });

    it('rejects weak secret patterns in production', async () => {
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32) + 'secret'; // contains "secret"
      process.env.JWT_SECRET = 'a'.repeat(40);
      // @ts-ignore
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      const { validateSecurityEnvironment } = await importModule();
      const result = validateSecurityEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('weak'))).toBe(true);
    });
  });

  // ------- Utility functions -------

  describe('sanitizeInput()', () => {
    it('removes angle brackets to prevent XSS', async () => {
      const { sanitizeInput } = await importModule();
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
        'scriptalert("xss")/script'
      );
    });

    it('trims whitespace', async () => {
      const { sanitizeInput } = await importModule();
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('truncates input longer than 1000 characters', async () => {
      const { sanitizeInput } = await importModule();
      const longInput = 'a'.repeat(2000);
      expect(sanitizeInput(longInput).length).toBe(1000);
    });
  });

  describe('isValidEmail()', () => {
    it('accepts valid email formats', async () => {
      const { isValidEmail } = await importModule();
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('first.last@domain.co')).toBe(true);
    });

    it('rejects invalid email formats', async () => {
      const { isValidEmail } = await importModule();
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@missing-local.com')).toBe(false);
      expect(isValidEmail('missing@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('generateSecureSecret()', () => {
    it('returns a string of the requested length', async () => {
      const { generateSecureSecret } = await importModule();
      const secret = generateSecureSecret(32);
      expect(secret).toHaveLength(32);
    });

    it('defaults to 64 characters when no length specified', async () => {
      const { generateSecureSecret } = await importModule();
      const secret = generateSecureSecret();
      expect(secret).toHaveLength(64);
    });

    it('produces different values on successive calls (randomness)', async () => {
      const { generateSecureSecret } = await importModule();
      const a = generateSecureSecret(64);
      const b = generateSecureSecret(64);
      expect(a).not.toBe(b);
    });
  });
});
