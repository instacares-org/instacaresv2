import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client to avoid connection issues
declare global {
  var __prisma: PrismaClient | undefined;
}

// Initialize Prisma client with proper configuration
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    errorFormat: 'pretty',
  });

  return client;
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Transaction helper with retry logic
export async function withTransaction<T>(
  operations: (tx: any) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(operations, {
        timeout: 10000, // 10 seconds for SQLite
        isolationLevel: 'ReadCommitted'
      });
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw lastError!;
}