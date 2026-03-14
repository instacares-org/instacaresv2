import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We must bypass the global setup.ts mock of @/lib/logger.
// Use vi.resetModules() + dynamic import to get the REAL logger implementation.

// We type-alias the module shape so we can reference it after dynamic import.
type LoggerModule = typeof import('@/lib/logger');

let loggerModule: LoggerModule;

beforeEach(async () => {
  // Reset all module caches so the real logger module is freshly loaded
  vi.resetModules();

  // Unmock the logger so the dynamic import gets the real code
  vi.unmock('@/lib/logger');

  // Spy on console methods to capture output and prevent noise
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});

  // Dynamically import the real logger
  loggerModule = await import('@/lib/logger');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// PII Redaction
// ---------------------------------------------------------------------------
describe('PII redaction', () => {
  it('redacts email local part while preserving domain', () => {
    const { logger } = loggerModule;
    logger.info('user email', { note: 'Contact user@example.com for details' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.note).toBe('Contact ***@example.com for details');
    expect(parsed.data.note).not.toContain('user@');
  });

  it('redacts multiple emails in the same string', () => {
    const { logger } = loggerModule;
    logger.info('emails', { text: 'alice@foo.com and bob@bar.org' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.text).toBe('***@foo.com and ***@bar.org');
  });

  it('redacts phone numbers formatted as 1234567890', () => {
    const { logger } = loggerModule;
    // Use a non-sensitive key name; "phone" is a sensitive key and would be fully redacted
    logger.info('phone', { note: 'Call 4165551234 now' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.note).toContain('***-***-****');
    expect(parsed.data.note).not.toContain('4165551234');
  });

  it('redacts phone numbers formatted as 416-555-1234', () => {
    const { logger } = loggerModule;
    logger.info('phone', { contact: 'Number: 416-555-1234' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.contact).toContain('***-***-****');
    expect(parsed.data.contact).not.toContain('416-555-1234');
  });

  it('redacts credit card numbers with spaces', () => {
    const { logger } = loggerModule;
    logger.info('card', { cc: 'Card: 4111 1111 1111 1111' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.cc).toContain('****-****-****-****');
    expect(parsed.data.cc).not.toContain('4111');
  });

  it('redacts credit card numbers with dashes', () => {
    const { logger } = loggerModule;
    logger.info('card', { cc: '5500-0000-0000-0004' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.cc).toBe('****-****-****-****');
  });
});

// ---------------------------------------------------------------------------
// Sensitive Key Detection
// ---------------------------------------------------------------------------
describe('Sensitive key detection', () => {
  const sensitiveKeys = [
    'password',
    'passwordHash',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'session',
    'bearer',
    'jwt',
    'accessToken',
    'refreshToken',
    'privateKey',
    'clientSecret',
    'client_secret',
    'authToken',
    'auth_token',
    'stripeToken',
    'stripe_token',
    'hasPassword',
  ];

  it.each(sensitiveKeys)('redacts value for key "%s"', (key) => {
    const { logger } = loggerModule;
    logger.info('sensitive', { [key]: 'super-secret-value-123' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data[key]).toBe('***REDACTED***');
  });

  it('does not redact non-sensitive keys', () => {
    const { logger } = loggerModule;
    logger.info('safe', { username: 'john', age: 30 });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.username).toBe('john');
    expect(parsed.data.age).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Nested Object Redaction
// ---------------------------------------------------------------------------
describe('Nested object redaction', () => {
  it('redacts sensitive keys in deeply nested objects', () => {
    const { logger } = loggerModule;
    logger.info('nested', {
      user: {
        name: 'Alice',
        credentials: {
          password: 'hunter2',
          token: 'abc-123',
        },
      },
    });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.user.name).toBe('Alice');
    expect(parsed.data.user.credentials.password).toBe('***REDACTED***');
    expect(parsed.data.user.credentials.token).toBe('***REDACTED***');
  });

  it('redacts PII inside nested string values', () => {
    const { logger } = loggerModule;
    logger.info('nested-string', {
      level1: {
        level2: {
          message: 'Reached out to admin@corp.com',
        },
      },
    });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.level1.level2.message).toBe('Reached out to ***@corp.com');
  });

  it('handles null and undefined data gracefully', () => {
    const { logger } = loggerModule;
    // Passing undefined data should not throw
    logger.info('no data');
    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('no data');
  });
});

// ---------------------------------------------------------------------------
// Log Levels (all methods)
// ---------------------------------------------------------------------------
describe('Log levels', () => {
  it('error() writes to console.error with level ERROR', () => {
    const { logger } = loggerModule;
    logger.error('something broke');

    expect(console.error).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string);
    expect(parsed.level).toBe('ERROR');
    expect(parsed.message).toBe('something broke');
  });

  it('warn() writes to console.warn with level WARN', () => {
    const { logger } = loggerModule;
    logger.warn('be careful');

    expect(console.warn).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.warn).mock.calls[0][0] as string);
    expect(parsed.level).toBe('WARN');
  });

  it('info() writes to console.info with level INFO', () => {
    const { logger } = loggerModule;
    logger.info('fyi');

    expect(console.info).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(parsed.level).toBe('INFO');
  });

  it('debug() writes to console.debug with level DEBUG', () => {
    // In test env (not production, not development), default level is INFO (2).
    // DEBUG (3) > INFO (2), so debug is NOT logged by default.
    // We need development env to enable debug. Re-import with NODE_ENV=development.
    vi.resetModules();
    vi.unmock('@/lib/logger');
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    return import('@/lib/logger').then((mod) => {
      mod.logger.debug('trace detail');
      expect(console.debug).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(vi.mocked(console.debug).mock.calls[0][0] as string);
      expect(parsed.level).toBe('DEBUG');
      process.env.NODE_ENV = origEnv;
    });
  });

  it('security() always logs with action security_event', () => {
    const { logger } = loggerModule;
    logger.security('intrusion detected', { attempt: 'brute-force' });

    expect(console.warn).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.warn).mock.calls[0][0] as string);
    expect(parsed.level).toBe('SECURITY');
    expect(parsed.action).toBe('security_event');
  });

  it('audit() always logs with action audit_event', () => {
    const { logger } = loggerModule;
    logger.audit('user approved', { userId: 'u1' });

    expect(console.info).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(parsed.level).toBe('AUDIT');
    expect(parsed.action).toBe('audit_event');
  });

  it('admin() always logs with action admin_action', () => {
    const { logger } = loggerModule;
    logger.admin('settings changed', { setting: 'rate' });

    expect(console.info).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(parsed.level).toBe('ADMIN');
    expect(parsed.action).toBe('admin_action');
  });
});

// ---------------------------------------------------------------------------
// Log Level Filtering
// ---------------------------------------------------------------------------
describe('Log level filtering', () => {
  it('production only logs ERROR and WARN (not INFO or DEBUG)', async () => {
    vi.resetModules();
    vi.unmock('@/lib/logger');
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const mod = await import('@/lib/logger');

    // Clear any calls from the import itself
    vi.mocked(console.error).mockClear();
    vi.mocked(console.warn).mockClear();
    vi.mocked(console.info).mockClear();
    vi.mocked(console.debug).mockClear();

    mod.logger.error('prod error');
    mod.logger.warn('prod warn');
    mod.logger.info('prod info');
    mod.logger.debug('prod debug');

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.info).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();

    process.env.NODE_ENV = origEnv;
  });

  it('development logs all levels including DEBUG', async () => {
    vi.resetModules();
    vi.unmock('@/lib/logger');
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const mod = await import('@/lib/logger');

    vi.mocked(console.error).mockClear();
    vi.mocked(console.warn).mockClear();
    vi.mocked(console.info).mockClear();
    vi.mocked(console.debug).mockClear();

    mod.logger.error('dev error');
    mod.logger.warn('dev warn');
    mod.logger.info('dev info');
    mod.logger.debug('dev debug');

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.debug).toHaveBeenCalledTimes(1);

    process.env.NODE_ENV = origEnv;
  });
});

// ---------------------------------------------------------------------------
// Error Logging
// ---------------------------------------------------------------------------
describe('Error logging', () => {
  it('extracts name, message, and stack from Error objects', () => {
    const { logger } = loggerModule;
    const err = new TypeError('bad type');

    logger.error('failed', err);

    const call = vi.mocked(console.error).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.errorName).toBe('TypeError');
    expect(parsed.data.errorMessage).toBe('bad type');
    expect(parsed.data.stack).toBeDefined();
    expect(typeof parsed.data.stack).toBe('string');
  });

  it('passes non-Error objects through as data', () => {
    const { logger } = loggerModule;
    logger.error('failed', { code: 'ERR_TIMEOUT', detail: 'connection lost' });

    const call = vi.mocked(console.error).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.data.code).toBe('ERR_TIMEOUT');
    expect(parsed.data.detail).toBe('connection lost');
  });

  it('handles error() called with no error argument', () => {
    const { logger } = loggerModule;
    logger.error('just a message');

    const call = vi.mocked(console.error).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.level).toBe('ERROR');
    expect(parsed.message).toBe('just a message');
  });
});

// ---------------------------------------------------------------------------
// getClientInfo
// ---------------------------------------------------------------------------
describe('getClientInfo', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const { getClientInfo } = loggerModule;
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.50',
        'user-agent': 'TestBrowser/1.0',
      },
    });

    const info = getClientInfo(req);
    expect(info.ip).toBe('203.0.113.50');
    expect(info.userAgent).toBe('TestBrowser/1.0');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const { getClientInfo } = loggerModule;
    const req = new Request('http://localhost', {
      headers: {
        'x-real-ip': '10.0.0.1',
        'user-agent': 'Bot/2.0',
      },
    });

    const info = getClientInfo(req);
    expect(info.ip).toBe('10.0.0.1');
  });

  it('returns "unknown" for IP when no IP headers present', () => {
    const { getClientInfo } = loggerModule;
    const req = new Request('http://localhost', {
      headers: {
        'user-agent': 'SomeAgent',
      },
    });

    const info = getClientInfo(req);
    expect(info.ip).toBe('unknown');
  });

  it('returns "unknown" for userAgent when header is missing', () => {
    const { getClientInfo } = loggerModule;
    const req = new Request('http://localhost');

    const info = getClientInfo(req);
    expect(info.userAgent).toBe('unknown');
    expect(info.ip).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Log entry structure
// ---------------------------------------------------------------------------
describe('Log entry structure', () => {
  it('includes timestamp in ISO format', () => {
    const { logger } = loggerModule;
    logger.info('test');

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.timestamp).toBeDefined();
    // Validate ISO-8601 format
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('includes meta fields when provided', () => {
    const { logger } = loggerModule;
    logger.info('with meta', { count: 1 }, { userId: 'u-42', ip: '1.2.3.4' });

    const call = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.userId).toBe('u-42');
    expect(parsed.ip).toBe('1.2.3.4');
    expect(parsed.data.count).toBe(1);
  });
});
