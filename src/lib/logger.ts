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
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
  action?: string;
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

  private formatLog(level: string, message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...meta
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  error(message: string, error?: Error | any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const logData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...error
    } : error;

    const logEntry = this.formatLog('ERROR', message, logData, meta);
    console.error(JSON.stringify(logEntry, null, 2));
  }

  warn(message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const logEntry = this.formatLog('WARN', message, data, meta);
    console.warn(JSON.stringify(logEntry, null, 2));
  }

  info(message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const logEntry = this.formatLog('INFO', message, data, meta);
    console.info(JSON.stringify(logEntry, null, 2));
  }

  debug(message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const logEntry = this.formatLog('DEBUG', message, data, meta);
    console.debug(JSON.stringify(logEntry, null, 2));
  }

  // Security-focused logging
  security(message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    const logEntry = this.formatLog('SECURITY', message, data, { action: 'security_event', ...meta });
    console.warn(JSON.stringify(logEntry, null, 2));
  }

  // Audit trail for admin actions
  audit(message: string, data?: any, meta?: Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'data'>) {
    const logEntry = this.formatLog('AUDIT', message, data, { action: 'audit_event', ...meta });
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