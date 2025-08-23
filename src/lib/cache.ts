// Simple in-memory cache with TTL for API performance optimization
// In production, replace with Redis for better scalability

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly maxSize = 1000; // Prevent memory leaks

  set<T>(key: string, data: T, ttlSeconds = 300): void {
    // Clean up if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
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
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
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
  caregivers: 300, // 5 minutes - frequently changing availability
  caregiver: 600, // 10 minutes - profile data changes less frequently
  bookings: 60, // 1 minute - booking status changes frequently
  chatRooms: 120, // 2 minutes - new messages need to appear quickly
  notifications: 30, // 30 seconds - real-time-ish updates
  reviews: 1800, // 30 minutes - reviews don't change often
  static: 3600, // 1 hour - for relatively static data
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);

// Development helper to monitor cache performance
if (process.env.NODE_ENV === 'development') {
  // Log cache stats every minute in development
  setInterval(() => {
    const stats = apiCache.getStats();
    if (stats.size > 0) {
      console.log('🗄️ Cache stats:', stats);
    }
  }, 60 * 1000);
}