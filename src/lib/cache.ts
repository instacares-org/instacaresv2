// Hybrid cache: Upstash Redis (primary) with in-memory Map fallback.
// All mutating methods are async so call sites can `await` them uniformly.

import { getRedisClient } from './redis';

const REDIS_PREFIX = 'cache:';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  size?: number; // Estimated size in bytes
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly maxSize = 200; // Reduced from 1000 to prevent memory leaks - optimized for typical traffic
  private readonly maxItemSize = 100000; // 100KB - prevent caching extremely large objects

  // Metrics for monitoring cache performance
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private oversizedSkips = 0;

  async set<T>(key: string, data: T, ttlSeconds = 300): Promise<void> {
    // Estimate size of data (rough approximation)
    let serialized: string;
    let estimatedSize = 0;
    try {
      serialized = JSON.stringify(data);
      estimatedSize = serialized.length;

      // Skip caching if single item exceeds size limit
      if (estimatedSize > this.maxItemSize) {
        this.oversizedSkips++;
        console.warn(`⚠️ Cache item too large, skipped: ${key} (${(estimatedSize / 1024).toFixed(2)} KB)`);
        return;
      }
    } catch (error) {
      // If we can't serialize, skip caching
      console.warn(`⚠️ Cache item not serializable, skipped: ${key}`);
      return;
    }

    // Try Redis first
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.set(REDIS_PREFIX + key, serialized!, { ex: ttlSeconds });
        return;
      }
    } catch (err) {
      console.warn('⚠️ Redis set failed, falling back to memory:', (err as Error).message);
    }

    // Fallback: in-memory Map
    // Clean up if cache is getting too large (LRU eviction)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
      this.evictions++;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
      size: estimatedSize,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    try {
      const redis = getRedisClient();
      if (redis) {
        const raw = await redis.get<string>(REDIS_PREFIX + key);
        if (raw === null || raw === undefined) {
          this.misses++;
          return null;
        }
        this.hits++;
        // @upstash/redis auto-deserializes JSON, so raw may already be an object
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw) as T;
          } catch {
            return raw as unknown as T;
          }
        }
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn('⚠️ Redis get failed, falling back to memory:', (err as Error).message);
    }

    // Fallback: in-memory Map
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.data as T;
  }

  async delete(key: string): Promise<void> {
    // Try Redis first
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(REDIS_PREFIX + key);
        return;
      }
    } catch (err) {
      console.warn('⚠️ Redis delete failed, falling back to memory:', (err as Error).message);
    }

    // Fallback: in-memory Map
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    // Try Redis first
    try {
      const redis = getRedisClient();
      if (redis) {
        // Use SCAN-based iteration to find all cache keys, then delete them.
        // @upstash/redis .scan() returns [cursor, keys].
        let cursor = 0;
        do {
          const result = await redis.scan(cursor, {
            match: REDIS_PREFIX + '*',
            count: 100,
          });
          cursor = Number(result[0]);
          const keys = result[1] as string[];
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== 0);
        return;
      }
    } catch (err) {
      console.warn('⚠️ Redis clear failed, falling back to memory:', (err as Error).message);
    }

    // Fallback: in-memory Map
    this.cache.clear();
  }

  // Invalidate all keys matching a pattern
  async invalidatePattern(pattern: string): Promise<number> {
    // Try Redis first
    try {
      const redis = getRedisClient();
      if (redis) {
        let count = 0;
        let cursor = 0;
        do {
          const result = await redis.scan(cursor, {
            match: REDIS_PREFIX + '*' + pattern + '*',
            count: 100,
          });
          cursor = Number(result[0]);
          const keys = result[1] as string[];
          if (keys.length > 0) {
            await redis.del(...keys);
            count += keys.length;
          }
        } while (cursor !== 0);
        return count;
      }
    } catch (err) {
      console.warn('⚠️ Redis invalidatePattern failed, falling back to memory:', (err as Error).message);
    }

    // Fallback: in-memory Map
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  // Clean up expired entries (in-memory only; Redis handles TTL natively)
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics for monitoring
  getStats() {
    // Calculate total cache memory usage
    let totalBytes = 0;
    for (const item of this.cache.values()) {
      totalBytes += item.size || 0;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      memoryUsage: `${(totalBytes / 1024).toFixed(2)} KB`,
      memoryUsageBytes: totalBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      oversizedSkips: this.oversizedSkips,
      hitRate: `${hitRate.toFixed(2)}%`,
      totalRequests,
    };
  }

  // Reset metrics (useful for monitoring intervals)
  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.oversizedSkips = 0;
  }
}

// Export singleton instance
export const apiCache = new MemoryCache();

// Cache key generators for consistent naming
export const cacheKeys = {
  caregivers: (params: Record<string, any>) => {
    const sorted = Object.keys(params).sort().reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {} as Record<string, any>);
    return `caregivers:${JSON.stringify(sorted)}`;
  },

  caregiver: (id: string) => `caregiver:${id}`,

  bookings: (userId: string, status?: string) =>
    `bookings:${userId}${status ? `:${status}` : ''}`,

  chatRooms: (userId: string, userType: string) =>
    `chat-rooms:${userId}:${userType}`,

  notifications: (userId: string) => `notifications:${userId}`,

  reviews: (caregiverId: string) => `reviews:${caregiverId}`,
};

// Cache configuration for different endpoints
export const cacheTTL = {
  caregivers: 180, // 3 minutes - reduced from 5 min to save memory while maintaining performance
  caregiver: 600, // 10 minutes - profile data changes less frequently
  bookings: 60, // 1 minute - booking status changes frequently
  chatRooms: 120, // 2 minutes - new messages need to appear quickly
  notifications: 30, // 30 seconds - real-time-ish updates
  reviews: 1800, // 30 minutes - reviews don't change often
  static: 3600, // 1 hour - for relatively static data
};

// Cleanup expired entries every 3 minutes (reduced from 5 for better memory management)
setInterval(() => {
  apiCache.cleanup();

  // Log metrics in production for monitoring
  if (process.env.NODE_ENV === 'production') {
    const stats = apiCache.getStats();
    console.log('📊 Cache Performance:', {
      size: stats.size,
      maxSize: stats.maxSize,
      memoryUsage: stats.memoryUsage,
      hitRate: stats.hitRate,
      evictions: stats.evictions,
      oversizedSkips: stats.oversizedSkips,
    });
  }
}, 3 * 60 * 1000);

// Development helper to monitor cache performance
if (process.env.NODE_ENV === 'development') {
  // Log detailed cache stats every minute in development
  setInterval(() => {
    const stats = apiCache.getStats();
    if (stats.size > 0) {
      console.log('🗄️ Cache stats:', stats);
    }
  }, 60 * 1000);
}
