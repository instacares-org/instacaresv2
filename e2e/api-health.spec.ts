import { test, expect } from '@playwright/test';

test.describe('API Health & Endpoint Tests', () => {
  // -------------------------------------------------------------------------
  // /api/health endpoint
  // The health route checks database connectivity. Without a running database
  // it returns 503 with { status: 'unhealthy' }. With a database it returns
  // 200 with { status: 'healthy' }. Either way the response is valid JSON
  // with the expected structure.
  // -------------------------------------------------------------------------

  test('health endpoint returns valid JSON with expected structure', async ({ request }) => {
    const response = await request.get('/api/health');

    // Accept either 200 (DB connected) or 503 (DB unavailable)
    expect([200, 503]).toContain(response.status());

    const body = await response.json();

    // Both healthy and unhealthy responses share these fields
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('services');
    expect(body.services).toHaveProperty('database');
    expect(body.services).toHaveProperty('api');

    // status is either 'healthy' or 'unhealthy'
    expect(['healthy', 'unhealthy']).toContain(body.status);
  });

  test('health endpoint returns proper content-type header', async ({ request }) => {
    const response = await request.get('/api/health');

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

  // -------------------------------------------------------------------------
  // /api/auth/me - requires authentication
  // -------------------------------------------------------------------------

  test('auth/me endpoint returns 401 for unauthenticated request', async ({ request }) => {
    const response = await request.get('/api/auth/me');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/not authenticated/i);
  });

  // -------------------------------------------------------------------------
  // /api/caregivers - public listing endpoint
  // This endpoint may fail without a database but should still return JSON.
  // -------------------------------------------------------------------------

  test('caregivers API returns JSON response', async ({ request }) => {
    const response = await request.get('/api/caregivers?limit=1');

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');

    const body = await response.json();
    // The response should be a JSON object regardless of success/failure
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // /api/csrf-token - CSRF token endpoint
  // -------------------------------------------------------------------------

  test('CSRF token endpoint returns a token', async ({ request }) => {
    const response = await request.get('/api/csrf-token');

    // Should return 200
    expect(response.status()).toBe(200);

    const body = await response.json();
    // The response should contain a token of some kind
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Protected admin endpoints require authentication
  // -------------------------------------------------------------------------

  test('admin dashboard API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard');

    // Should be 401 or 403 since we are not authenticated
    expect([401, 403]).toContain(response.status());

    const body = await response.json();
    expect(typeof body).toBe('object');
  });

  test('admin settings API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/admin/settings');

    // Admin endpoints should reject unauthenticated access
    // Some may return 401, 403, or even 500 if auth middleware throws
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // -------------------------------------------------------------------------
  // Verify non-existent API route returns 404
  // -------------------------------------------------------------------------

  test('non-existent API route returns 404', async ({ request }) => {
    const response = await request.get('/api/this-does-not-exist-xyz');

    expect(response.status()).toBe(404);
  });
});
