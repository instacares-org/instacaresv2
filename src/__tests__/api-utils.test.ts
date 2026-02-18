import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiSuccess, apiError, ApiErrors, requireAuth } from '@/lib/api-utils';
import { getServerSession } from 'next-auth';

const mockGetServerSession = vi.mocked(getServerSession);

describe('apiSuccess', () => {
  it('returns success: true with data', async () => {
    const res = apiSuccess({ id: '1' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { id: '1' } });
  });

  it('includes message when provided', async () => {
    const res = apiSuccess({ id: '1' }, 'Created');
    const body = await res.json();
    expect(body.message).toBe('Created');
  });

  it('supports custom status code', async () => {
    const res = apiSuccess(undefined, 'Created', 201);
    expect(res.status).toBe(201);
  });

  it('omits data key when undefined', async () => {
    const res = apiSuccess(undefined, 'ok');
    const body = await res.json();
    expect(body).toEqual({ success: true, message: 'ok' });
    expect('data' in body).toBe(false);
  });
});

describe('apiError', () => {
  it('returns success: false with error message', async () => {
    const res = apiError('Bad input', 400);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Bad input' });
  });

  it('includes details when provided', async () => {
    const res = apiError('Validation', 400, [{ field: 'email' }]);
    const body = await res.json();
    expect(body.details).toEqual([{ field: 'email' }]);
  });
});

describe('ApiErrors', () => {
  it('unauthorized returns 401', async () => {
    const res = ApiErrors.unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('forbidden returns 403', async () => {
    const res = ApiErrors.forbidden('No access');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('No access');
  });

  it('notFound returns 404', async () => {
    const res = ApiErrors.notFound();
    expect(res.status).toBe(404);
  });

  it('badRequest returns 400 with optional details', async () => {
    const res = ApiErrors.badRequest('Bad', { fields: ['name'] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details).toEqual({ fields: ['name'] });
  });

  it('conflict returns 409', async () => {
    const res = ApiErrors.conflict();
    expect(res.status).toBe(409);
  });

  it('tooManyRequests returns 429 with Retry-After header', async () => {
    const res = ApiErrors.tooManyRequests();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('internal returns 500', async () => {
    const res = ApiErrors.internal();
    expect(res.status).toBe(500);
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when no session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireAuth();
    expect(result.error).toBeDefined();
    expect(result.user).toBeUndefined();
    expect(result.error!.status).toBe(401);
  });

  it('returns user when session is valid', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        userType: 'PARENT',
        approvalStatus: 'APPROVED',
        isActive: true,
        isParent: true,
        isCaregiver: false,
        isBabysitter: false,
        activeRole: 'PARENT',
      },
    });

    const result = await requireAuth();
    expect(result.user).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.user!.id).toBe('user-1');
    expect(result.user!.email).toBe('test@example.com');
  });

  it('returns error for inactive account', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        isActive: false,
      },
    });

    const result = await requireAuth();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it('returns error when role does not match', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        userType: 'PARENT',
        isActive: true,
        isParent: true,
        isCaregiver: false,
        isBabysitter: false,
      },
    });

    const result = await requireAuth('CAREGIVER');
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it('ADMIN bypasses all role checks', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        userType: 'ADMIN',
        isActive: true,
        activeRole: 'ADMIN',
      },
    });

    const result = await requireAuth('PARENT');
    expect(result.user).toBeDefined();
    expect(result.user!.userType).toBe('ADMIN');
  });

  it('BABYSITTER role checks isBabysitter flag', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'bs@example.com',
        userType: 'PARENT',
        isActive: true,
        isParent: true,
        isBabysitter: true,
        activeRole: 'PARENT',
      },
    });

    const result = await requireAuth('BABYSITTER');
    expect(result.user).toBeDefined();
  });
});
