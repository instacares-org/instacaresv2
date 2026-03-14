import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers – create a minimal JWT with a given `exp` (seconds since epoch)
// ---------------------------------------------------------------------------
function createJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp }));
  const signature = btoa('fake-signature');
  return `${header}.${payload}.${signature}`;
}

// ---------------------------------------------------------------------------
// Because token-manager.ts is a module-level singleton that auto-starts in
// browser environments, we must use vi.resetModules() + dynamic import so
// each test gets a fresh instance. The global setup mocks logger & db which
// is fine -- we don't need those here.
// ---------------------------------------------------------------------------
describe('token-manager', () => {
  // Stubs that we inject into the global scope before each import
  let cookieStore: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  let locationMock: { pathname: string; href: string };
  let sessionStorageMock: Record<string, string>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    // Reset cookie store
    cookieStore = '';

    // Minimal fetch mock – defaults to a successful refresh
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    locationMock = { pathname: '/dashboard', href: '' };
    sessionStorageMock = {};

    // Provide browser globals that token-manager expects
    vi.stubGlobal('window', {
      location: locationMock,
    });
    vi.stubGlobal('document', {
      cookie: '',
      hidden: false,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => sessionStorageMock[key] ?? null,
      setItem: (key: string, value: string) => { sessionStorageMock[key] = value; },
      removeItem: (key: string) => { delete sessionStorageMock[key]; },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('utf-8'));
    vi.stubGlobal('btoa', (str: string) => Buffer.from(str, 'utf-8').toString('base64'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Helper: set a cookie value that the manager reads
  function setCookie(token: string) {
    (globalThis as any).document.cookie = `auth-token=${encodeURIComponent(token)}`;
  }

  // ------------------------------------------------------------------
  // Singleton behaviour
  // ------------------------------------------------------------------
  it('getInstance returns the same instance on repeated calls', async () => {
    const { default: tm1 } = await import('@/lib/token-manager');
    const { default: tm2 } = await import('@/lib/token-manager');
    expect(tm1).toBe(tm2);
  });

  // ------------------------------------------------------------------
  // Token parsing – valid JWT
  // ------------------------------------------------------------------
  it('correctly parses a JWT expiry from a cookie token', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const jwt = createJwt(futureExp);
    setCookie(jwt);

    // Import triggers initializeTokenRefresh -> scheduleNextRefresh
    // Because the token is > 5 min away from expiry, it should NOT call fetch yet
    await import('@/lib/token-manager');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Token expiring soon triggers immediate refresh
  // ------------------------------------------------------------------
  it('triggers an immediate refresh when the token is expiring within 5 minutes', async () => {
    const soonExp = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
    setCookie(createJwt(soonExp));

    await import('@/lib/token-manager');

    // The manager should have called fetch to /api/auth/refresh
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
  });

  // ------------------------------------------------------------------
  // Scheduled refresh fires at the right time
  // ------------------------------------------------------------------
  it('schedules a refresh 5 minutes before token expiry', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
    setCookie(createJwt(futureExp));

    await import('@/lib/token-manager');

    // No immediate fetch
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance time to ~15 min (should trigger the scheduled refresh)
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // forceRefresh calls the refresh endpoint
  // ------------------------------------------------------------------
  it('forceRefresh calls /api/auth/refresh and returns true on success', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));

    const { default: tm } = await import('@/lib/token-manager');

    const result = await tm.forceRefresh();
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.anything());
  });

  // ------------------------------------------------------------------
  // forceRefresh returns false on failure
  // ------------------------------------------------------------------
  it('forceRefresh returns false when the server responds with an error', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const { default: tm } = await import('@/lib/token-manager');
    const result = await tm.forceRefresh();
    expect(result).toBe(false);
  });

  // ------------------------------------------------------------------
  // forceRefresh returns false on network error
  // ------------------------------------------------------------------
  it('forceRefresh returns false on a network exception', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));

    fetchMock.mockRejectedValueOnce(new Error('Network failure'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: tm } = await import('@/lib/token-manager');
    const result = await tm.forceRefresh();
    expect(result).toBe(false);
    consoleSpy.mockRestore();
  });

  // ------------------------------------------------------------------
  // Redirect on token expiry for protected pages
  // ------------------------------------------------------------------
  it('redirects to /login when refresh fails on a protected page', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));
    locationMock.pathname = '/dashboard';

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: tm } = await import('@/lib/token-manager');
    await tm.forceRefresh();

    expect(locationMock.href).toBe('/login');
    expect(sessionStorageMock['redirectAfterLogin']).toBe('/dashboard');
    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------
  // No redirect on public pages
  // ------------------------------------------------------------------
  it('does NOT redirect when the user is on a public page', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));
    locationMock.pathname = '/login';

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: tm } = await import('@/lib/token-manager');
    await tm.forceRefresh();

    expect(locationMock.href).not.toBe('/login');
    warnSpy.mockRestore();
  });

  // ------------------------------------------------------------------
  // stop() clears the refresh timer
  // ------------------------------------------------------------------
  it('stop() prevents the scheduled refresh from firing', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 1200;
    setCookie(createJwt(futureExp));

    const { default: tm } = await import('@/lib/token-manager');
    expect(fetchMock).not.toHaveBeenCalled();

    tm.stop();

    // Advance past when the refresh would have fired
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);

    // fetch should never have been called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Malformed / missing token handling
  // ------------------------------------------------------------------
  it('gracefully handles a missing auth-token cookie', async () => {
    // cookie is empty by default -- no token set
    const { default: tm } = await import('@/lib/token-manager');

    // Should not throw, should not call fetch
    expect(fetchMock).not.toHaveBeenCalled();

    // forceRefresh still works (calls fetch, but the server decides)
    const result = await tm.forceRefresh();
    expect(result).toBe(true); // fetch mock returns ok by default
  });

  it('handles a malformed (non-JWT) token without throwing', async () => {
    setCookie('this-is-not-a-jwt');

    // Should not throw during import / initialization
    const { default: tm } = await import('@/lib/token-manager');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Deduplication – isRefreshing guard
  // ------------------------------------------------------------------
  it('deduplicates concurrent forceRefresh calls', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));

    // Make fetch take some time to respond
    fetchMock.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: true, json: async () => ({ success: true }) }), 100),
      ),
    );

    const { default: tm } = await import('@/lib/token-manager');

    // Fire two concurrent refreshes
    const p1 = tm.forceRefresh();
    const p2 = tm.forceRefresh();

    // Advance timers so the fetch resolves
    await vi.advanceTimersByTimeAsync(200);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);

    // fetch should have been called only once due to the isRefreshing guard
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Visibility change listener registration
  // ------------------------------------------------------------------
  it('registers a visibilitychange listener on initialization', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setCookie(createJwt(futureExp));

    await import('@/lib/token-manager');

    expect((globalThis as any).document.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});
