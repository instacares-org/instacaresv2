import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the redis module so tests always use the in-memory fallback
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => null,
  isRedisAvailable: () => false,
}));

describe('MemoryCache (apiCache)', () => {
  // We use vi.resetModules() + dynamic import so each test group gets a fresh
  // singleton instance without leftover state from previous tests.

  let apiCache: typeof import('@/lib/cache').apiCache;
  let cacheKeys: typeof import('@/lib/cache').cacheKeys;
  let cacheTTL: typeof import('@/lib/cache').cacheTTL;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    // Suppress console.warn / console.log from the cache module (interval logs, oversized warnings)
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('@/lib/cache');
    apiCache = mod.apiCache;
    cacheKeys = mod.cacheKeys;
    cacheTTL = mod.cacheTTL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ------- Basic set / get -------

  it('stores and retrieves a string value', async () => {
    await apiCache.set('key1', 'hello');
    expect(await apiCache.get('key1')).toBe('hello');
  });

  it('stores and retrieves an object value', async () => {
    const obj = { name: 'Jane', roles: ['admin', 'user'] };
    await apiCache.set('user:1', obj);
    expect(await apiCache.get('user:1')).toEqual(obj);
  });

  it('stores and retrieves different data types', async () => {
    await apiCache.set('number', 42);
    await apiCache.set('boolean', true);
    await apiCache.set('array', [1, 2, 3]);
    await apiCache.set('nested', { a: { b: { c: 'deep' } } });

    expect(await apiCache.get('number')).toBe(42);
    expect(await apiCache.get('boolean')).toBe(true);
    expect(await apiCache.get('array')).toEqual([1, 2, 3]);
    const nested = await apiCache.get<{ a: { b: { c: string } } }>('nested');
    expect(nested?.a.b.c).toBe('deep');
  });

  // ------- Cache miss -------

  it('returns null for a cache miss on a non-existent key', async () => {
    expect(await apiCache.get('does-not-exist')).toBeNull();
  });

  // ------- TTL / expiry -------

  it('returns value before TTL expires', async () => {
    await apiCache.set('ttl-test', 'data', 10); // 10-second TTL
    vi.advanceTimersByTime(9_000); // 9 seconds later
    expect(await apiCache.get('ttl-test')).toBe('data');
  });

  it('returns null after TTL expires', async () => {
    await apiCache.set('ttl-test', 'data', 10); // 10-second TTL
    vi.advanceTimersByTime(11_000); // 11 seconds later
    expect(await apiCache.get('ttl-test')).toBeNull();
  });

  it('uses default TTL of 300 seconds when none specified', async () => {
    await apiCache.set('default-ttl', 'value');
    // Advance 299 seconds - should still be cached
    vi.advanceTimersByTime(299_000);
    expect(await apiCache.get('default-ttl')).toBe('value');
    // Advance past 300 seconds total
    vi.advanceTimersByTime(2_000);
    expect(await apiCache.get('default-ttl')).toBeNull();
  });

  // ------- Delete / invalidation -------

  it('deletes a single key', async () => {
    await apiCache.set('del-me', 'value');
    expect(await apiCache.get('del-me')).toBe('value');
    await apiCache.delete('del-me');
    expect(await apiCache.get('del-me')).toBeNull();
  });

  it('clears all entries', async () => {
    await apiCache.set('a', 1);
    await apiCache.set('b', 2);
    await apiCache.clear();
    expect(await apiCache.get('a')).toBeNull();
    expect(await apiCache.get('b')).toBeNull();
    expect(apiCache.getStats().size).toBe(0);
  });

  it('invalidates entries matching a pattern', async () => {
    await apiCache.set('bookings:user1:pending', 'x');
    await apiCache.set('bookings:user1:confirmed', 'y');
    await apiCache.set('caregiver:99', 'z');

    const removed = await apiCache.invalidatePattern('bookings:user1');
    expect(removed).toBe(2);
    expect(await apiCache.get('bookings:user1:pending')).toBeNull();
    expect(await apiCache.get('bookings:user1:confirmed')).toBeNull();
    // Unrelated key is preserved
    expect(await apiCache.get('caregiver:99')).toBe('z');
  });

  // ------- Key isolation -------

  it('isolates values under different keys', async () => {
    await apiCache.set('key-a', 'alpha');
    await apiCache.set('key-b', 'beta');
    expect(await apiCache.get('key-a')).toBe('alpha');
    expect(await apiCache.get('key-b')).toBe('beta');
  });

  // ------- LRU eviction -------

  it('evicts the oldest entry when maxSize (200) is reached', async () => {
    // Fill cache to capacity
    for (let i = 0; i < 200; i++) {
      await apiCache.set(`item-${i}`, `value-${i}`);
    }
    // Add one more - the first item should be evicted
    await apiCache.set('item-200', 'value-200');
    expect(await apiCache.get('item-0')).toBeNull(); // evicted
    expect(await apiCache.get('item-200')).toBe('value-200'); // new entry present
    expect(apiCache.getStats().evictions).toBeGreaterThanOrEqual(1);
  });

  // ------- Oversized items -------

  it('skips caching items that exceed maxItemSize (100 KB)', async () => {
    const largeData = 'x'.repeat(200_000); // ~200 KB
    await apiCache.set('big', largeData);
    expect(await apiCache.get('big')).toBeNull();
    expect(apiCache.getStats().oversizedSkips).toBe(1);
  });

  // ------- Cleanup expired entries -------

  it('cleanup() removes expired entries and preserves live ones', async () => {
    await apiCache.set('short', 'quick', 5);
    await apiCache.set('long', 'lasting', 60);
    vi.advanceTimersByTime(10_000); // 10 seconds - short TTL expired
    apiCache.cleanup();
    expect(await apiCache.get('short')).toBeNull();
    expect(await apiCache.get('long')).toBe('lasting');
  });

  // ------- Stats / metrics -------

  it('tracks hits and misses in getStats()', async () => {
    await apiCache.set('present', 'yes');
    await apiCache.get('present'); // hit
    await apiCache.get('absent'); // miss

    const stats = apiCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('50.00%');
    expect(stats.totalRequests).toBe(2);
  });

  it('resetMetrics() zeroes out counters', async () => {
    await apiCache.set('k', 'v');
    await apiCache.get('k');
    await apiCache.get('missing');
    apiCache.resetMetrics();

    const stats = apiCache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
    expect(stats.oversizedSkips).toBe(0);
  });

  // ------- Cache key generators -------

  it('cacheKeys.caregivers sorts params for consistent keys', () => {
    const a = cacheKeys.caregivers({ zip: '90210', service: 'babysitting' });
    const b = cacheKeys.caregivers({ service: 'babysitting', zip: '90210' });
    expect(a).toBe(b);
    expect(a).toContain('caregivers:');
  });

  it('cacheKeys helpers produce expected prefixes', () => {
    expect(cacheKeys.caregiver('abc')).toBe('caregiver:abc');
    expect(cacheKeys.bookings('u1')).toBe('bookings:u1');
    expect(cacheKeys.bookings('u1', 'pending')).toBe('bookings:u1:pending');
    expect(cacheKeys.chatRooms('u2', 'PARENT')).toBe('chat-rooms:u2:PARENT');
    expect(cacheKeys.notifications('u3')).toBe('notifications:u3');
    expect(cacheKeys.reviews('cg4')).toBe('reviews:cg4');
  });

  // ------- cacheTTL constants -------

  it('cacheTTL contains expected values in seconds', () => {
    expect(cacheTTL.caregivers).toBe(180);
    expect(cacheTTL.caregiver).toBe(600);
    expect(cacheTTL.bookings).toBe(60);
    expect(cacheTTL.chatRooms).toBe(120);
    expect(cacheTTL.notifications).toBe(30);
    expect(cacheTTL.reviews).toBe(1800);
    expect(cacheTTL.static).toBe(3600);
  });
});
