import { PrismaClient } from '@prisma/client';
import { apiCache } from './cache';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced Prisma client with connection retry logic
function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'query' },
        ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Add connection pooling configuration
    // Explicitly set connection pool size
  });

  // Connection retry logic
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  async function executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries > 0 && isRetriableError(error)) {
        console.warn(`Database operation failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`, {
          error: error.message,
          code: error.code
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return executeWithRetry(operation, retries - 1);
      }
      throw error;
    }
  }

  function isRetriableError(error: any): boolean {
    const retriableCodes = [
      'P1001', // Can't reach database
      'P1002', // Database timeout
      'P1008', // Operations timed out
      'P1017', // Connection dropped
      'P2024', // Connection pool timeout
    ];
    return retriableCodes.includes(error.code) || 
           error.message?.includes('Connection') ||
           error.message?.includes('timeout');
  }

  // Enhance client with retry logic
  const enhancedClient = new Proxy(client, {
    get(target, prop) {
      const original = target[prop as keyof typeof target];
      
      // Don't wrap internal methods
      if (typeof prop === 'string' && prop.startsWith('$')) {
        return original;
      }
      
      // Wrap model operations with retry logic
      if (typeof original === 'object' && original !== null) {
        return new Proxy(original, {
          get(modelTarget, modelProp) {
            const modelMethod = modelTarget[modelProp as keyof typeof modelTarget];
            
            if (typeof modelMethod === 'function') {
              return (...args: any[]) => {
                return executeWithRetry(() => (modelMethod as (...a: any[]) => any).apply(modelTarget, args));
              };
            }
            
            return modelMethod;
          }
        });
      }
      
      return original;
    }
  });

  // Log slow queries in production
  if (process.env.NODE_ENV === 'production') {
    client.$on('query' as never, (e: any) => {
      if (e.duration > 2000) {
        console.warn('⚠️ Slow query detected:', {
          query: e.query,
          duration: `${e.duration}ms`,
          params: e.params,
        });
      }
    });
    
    client.$on('error' as never, (e: any) => {
      console.error('❌ Database error:', e);
    });

    client.$on('warn' as never, (e: any) => {
      console.warn('⚠️ Database warning:', e);
    });
  }

  return enhancedClient;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// IMPORTANT: DO NOT disconnect in API routes!
// Prisma client is a singleton and should stay connected
// Only disconnect on application shutdown

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    console.log('Application shutting down, disconnecting database...');
    await db.$disconnect();
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, disconnecting database...');
    await db.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, disconnecting database...');
    await db.$disconnect();
    process.exit(0);
  });
}
