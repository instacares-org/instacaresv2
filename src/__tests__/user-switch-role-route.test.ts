import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/user/switch-role/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

const mockDb = vi.mocked(db, true);
const mockGetServerSession = vi.mocked(getServerSession);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSession(overrides: Record<string, unknown> = {}) {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'dual@test.com',
      userType: 'PARENT',
      isActive: true,
      isParent: true,
      isCaregiver: true,
      activeRole: 'PARENT',
      ...overrides,
    },
  });
}

function createSwitchRequest(body: object) {
  return new NextRequest('http://localhost:3005/api/user/switch-role', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const dualRoleUser = {
  id: 'user-1',
  email: 'dual@test.com',
  isParent: true,
  isCaregiver: true,
  activeRole: 'PARENT',
  userType: 'PARENT',
};

// ========================== POST /api/user/switch-role ==========================

describe('POST /api/user/switch-role', () => {
  beforeEach(() => vi.clearAllMocks());

  it('switches from PARENT to CAREGIVER for dual-role user', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue(dualRoleUser as any);
    mockDb.user.update.mockResolvedValue({
      ...dualRoleUser,
      activeRole: 'CAREGIVER',
      userType: 'CAREGIVER',
    } as any);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('caregiver');
    expect(body.data.user.activeRole).toBe('CAREGIVER');
  });

  it('switches from CAREGIVER to PARENT for dual-role user', async () => {
    mockSession({ activeRole: 'CAREGIVER', userType: 'CAREGIVER' });
    mockDb.user.findUnique.mockResolvedValue({
      ...dualRoleUser,
      activeRole: 'CAREGIVER',
    } as any);
    mockDb.user.update.mockResolvedValue({
      ...dualRoleUser,
      activeRole: 'PARENT',
      userType: 'PARENT',
    } as any);

    const req = createSwitchRequest({ role: 'PARENT' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('parent');
    expect(body.data.user.activeRole).toBe('PARENT');
  });

  it('updates both activeRole and userType for backward compatibility', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue(dualRoleUser as any);
    mockDb.user.update.mockResolvedValue({
      ...dualRoleUser,
      activeRole: 'CAREGIVER',
      userType: 'CAREGIVER',
    } as any);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    await POST(req);

    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          activeRole: 'CAREGIVER',
          userType: 'CAREGIVER',
        }),
      })
    );
  });

  it('rejects invalid role value', async () => {
    mockSession();

    const req = createSwitchRequest({ role: 'ADMIN' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('rejects missing role field', async () => {
    mockSession();

    const req = createSwitchRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  it('rejects switching to CAREGIVER when user has no caregiver role', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isParent: true,
      isCaregiver: false,
      activeRole: 'PARENT',
    } as any);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('caregiver role');
  });

  it('rejects switching to PARENT when user has no parent role', async () => {
    mockSession({ userType: 'CAREGIVER' });
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isParent: false,
      isCaregiver: true,
      activeRole: 'CAREGIVER',
    } as any);

    const req = createSwitchRequest({ role: 'PARENT' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('parent role');
  });

  it('rejects unauthenticated requests (no session)', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('rejects session without user id', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'no-id@test.com' },
    });

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 404 when user is not found in database', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue(null);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('User not found');
  });

  it('returns response with correct user shape', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue(dualRoleUser as any);
    mockDb.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'dual@test.com',
      isParent: true,
      isCaregiver: true,
      activeRole: 'CAREGIVER',
      userType: 'CAREGIVER',
    } as any);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    const body = await res.json();
    expect(body.data.user).toEqual({
      id: 'user-1',
      email: 'dual@test.com',
      isParent: true,
      isCaregiver: true,
      activeRole: 'CAREGIVER',
    });
    // userType should not be leaked into the response user object
    expect(body.data.user.userType).toBeUndefined();
  });

  it('returns 500 when database throws an unexpected error', async () => {
    mockSession();
    mockDb.user.findUnique.mockRejectedValue(new Error('Connection refused'));

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to switch role');
  });

  it('selects only necessary fields from user lookup', async () => {
    mockSession();
    mockDb.user.findUnique.mockResolvedValue(dualRoleUser as any);
    mockDb.user.update.mockResolvedValue(dualRoleUser as any);

    const req = createSwitchRequest({ role: 'CAREGIVER' });
    await POST(req);

    expect(mockDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          isParent: true,
          isCaregiver: true,
          activeRole: true,
        }),
      })
    );
  });
});
