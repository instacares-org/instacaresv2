export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: Record<string, unknown>;
  userId?: string;
  ip?: string;
  userAgent?: string;
  action?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'production') {
      this.level = LogLevel.WARN;
    } else if (process.env.NODE_ENV === 'development') {
      this.level = LogLevel.DEBUG;
    }
  }

  /**
   * Redact sensitive PII and credentials from logs
   */
  private redactSensitive(data: unknown): unknown {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      // Redact email addresses (keep domain for debugging)
      let redacted = data.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$2');
      // Redact phone numbers
      redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
      // Redact credit card numbers
      redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****');
      return redacted;
    }

    if (typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const redacted: Record<string, unknown> = Array.isArray(data) ? ([] as unknown as Record<string, unknown>) : {};
      const sensitiveKeys = [
        'password', 'passwordhash', 'secret', 'token', 'apikey', 'api_key',
        'email', 'phone', 'phonenumber', 'ssn', 'creditcard', 'cardnumber',
        'stripetoken', 'stripe_token', 'authorization', 'cookie', 'session',
        'bearer', 'jwt', 'accesstoken', 'refreshtoken', 'privatekey',
        'clientsecret', 'client_secret', 'authtoken', 'auth_token', 'haspassword'
      ];

      for (const key in record) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(s => lowerKey.includes(s));

        if (isSensitive) {
          redacted[key] = '***REDACTED***';
        } else if (typeof record[key] === 'object') {
          redacted[key] = this.redactSensitive(record[key]);
        } else if (typeof record[key] === 'string') {
          redacted[key] = this.redactSensitive(record[key]);
        } else {
          redacted[key] = record[key];
        }
      }
      return redacted;
    }

    return data;
  }

  private formatLog(level: string, message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: this.redactSensitive(data) as Record<string, unknown>,
      ...meta
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  error(message: string, error?: Error | unknown, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const logData = error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    } : error;

    const logEntry = this.formatLog('ERROR', message, logData as Record<string, unknown>, meta);
    console.error(JSON.stringify(logEntry, null, 2));
  }

  warn(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const logEntry = this.formatLog('WARN', message, data, meta);
    console.warn(JSON.stringify(logEntry, null, 2));
  }

  info(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const logEntry = this.formatLog('INFO', message, data, meta);
    console.info(JSON.stringify(logEntry, null, 2));
  }

  debug(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const logEntry = this.formatLog('DEBUG', message, data, meta);
    console.debug(JSON.stringify(logEntry, null, 2));
  }

  // Security-focused logging
  security(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    const logEntry = this.formatLog('SECURITY', message, data, { action: 'security_event', ...meta });
    console.warn(JSON.stringify(logEntry, null, 2));
  }

  // Audit trail for admin actions
  audit(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    const logEntry = this.formatLog('AUDIT', message, data, { action: 'audit_event', ...meta });
    console.info(JSON.stringify(logEntry, null, 2));
  }

  // Admin action logging
  admin(message: string, data?: Record<string, unknown>, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    const logEntry = this.formatLog('ADMIN', message, data, { action: 'admin_action', ...meta });
    console.info(JSON.stringify(logEntry, null, 2));
  }
}

export const logger = new Logger();

// Helper to extract client info from request
export function getClientInfo(request: Request) {
  return {
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  };
}
