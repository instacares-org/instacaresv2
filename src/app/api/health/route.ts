import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      ci_pipeline: 'v2',
      services: {
        database: 'connected',
        api: 'operational'
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
      }
    };

    return apiSuccess(healthStatus);
  } catch (error) {
    // 503 Service Unavailable - use apiError directly since no helper for 503
    return apiError('Database connection failed', 503, {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        database: 'disconnected',
        api: 'degraded'
      }
    });
  }
}
