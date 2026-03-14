import { Redis } from '@upstash/redis';

// Singleton Redis client, or null when credentials are absent (local dev)
let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

export function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}
