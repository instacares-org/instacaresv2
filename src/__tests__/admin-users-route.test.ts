import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GET_PENDING } from '@/app/api/admin/users/pending/route';
import { POST as POST_RESET_PASSWORD } from '@/app/api/admin/users/[userId]/reset-password/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

// Mock withAuth middleware used by pending and status routes
const mockWithAuth = vi.fn();
vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock @/lib/db (prisma) used by approval and status routes
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
};
const mockPrismaCaregiver = {
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};
const mockPrismaUserProfile = {
  findUnique: vi.fn(),
  update: vi.fn(),
};
vi.mock('@/lib/db', () => ({
  db: {
    user: mockPrismaUser,
    caregiver: mockPrismaCaregiver,
    userProfile: mockPrismaUserProfile,
    platformSettings: { findFirst: vi.fn().mockResolvedValue(null) },
  },
  prisma: {
    user: mockPrismaUser,
    caregiver: mockPrismaCaregiver,
    userProfile: mockPrismaUserProfile,
    platformSettings: { findFirst: vi.fn().mockResolvedValue(null) },
  },
  withTransaction: vi.fn(),
}));

// Mock validation module used by approval route
vi.mock('@/lib/validation', () => ({
  approvalSchema: {
    safeParse: vi.fn((data: { action?: string; reason?: string }) => {
      const validActions = ['APPROVED', 'REJECTED', 'SUSPENDED'];
      if (!data.action || !validActions.includes(data.action)) {
        return {
          success: false,
          error: { issues: [{ message: 'Invalid approval action' }] },
        };
      }
      return { success: true, data: { action: data.action, reason: data.reason } };
    }),
  },
}));

// Mock audit-log module
vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: vi.fn(),
  AuditActions: {
    USER_APPROVED: 'USER_APPROVED',
    USER_REJECTED: 'USER_REJECTED',
    USER_SUSPENDED: 'USER_SUSPENDED',
    USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
    USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  },
}));

// Mock security-config used by auth-middleware
vi.mock('@/lib/security-config', () => ({
  SECURITY_CONFIG: { RATE_LIMITS: { AUTH_ENDPOINTS: { WINDOW_MS: 60000, REQUESTS: 100 } } },
  logSecurityEvent: vi.fn(),
}));

// Mock bcryptjs for reset-password
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password-123') },
}));

// Mock email service for reset-password
vi.mock('@/lib/notifications/email.service', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const mockDb = vi.mocked(db, true);
const mockGetServerSession = vi.mocked(getServerSession);

// ---------------------------------------------------------------------------
// Helper: mock withAuth returning an authorized admin
// ---------------------------------------------------------------------------
function mockAdminAuth(id = 'admin-1', email = 'admin@test.com') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: true,
    user: {
      id,
      email,
      userType: 'ADMIN',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: mock withAuth returning an unauthorized response
// ---------------------------------------------------------------------------
function mockUnauthorized(status = 401, message = 'Authentication required') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: false,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

// ---------------------------------------------------------------------------
// Helper: mock getServerSession for admin (used by reset-password)
// ---------------------------------------------------------------------------
function mockAdminSession(id = 'admin-1', email = 'admin@test.com') {
  mockGetServerSession.mockResolvedValue({
    user: {
      id,
      email,
      userType: 'ADMIN',
      isActive: true,
      activeRole: 'ADMIN',
    },
  });
}

// ========================== GET /api/admin/users/pending ==========================

describe('GET /api/admin/users/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending users for admin', async () => {
    mockAdminAuth();
    const pendingUsers = [
      {
        id: 'user-1',
        email: 'pending1@test.com',
        userType: 'CAREGIVER',
        approvalStatus: 'PENDING',
        createdAt: new Date(),
        profile: { firstName: 'Alice', lastName: 'Smith' },
        caregiver: null,
      },
      {
        id: 'user-2',
        email: 'pending2@test.com',
        userType: 'PARENT',
        approvalStatus: 'PENDING',
        createdAt: new Date(),
        profile: { firstName: 'Bob', lastName: 'Jones' },
        caregiver: null,
      },
    ];
    mockDb.user.findMany.mockResolvedValue(pendingUsers as any);

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    const res = await GET_PENDING(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.users).toHaveLength(2);
    expect(body.data.users[0].email).toBe('pending1@test.com');
  });

  it('rejects unauthenticated requests', async () => {
    mockUnauthorized(401, 'Authentication required');

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    const res = await GET_PENDING(req);

    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    mockUnauthorized(403, 'Insufficient permissions');

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    const res = await GET_PENDING(req);

    expect(res.status).toBe(403);
  });

  it('returns empty array when no pending users', async () => {
    mockAdminAuth();
    mockDb.user.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    const res = await GET_PENDING(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.users).toEqual([]);
  });

  it('queries with correct where clause and ordering', async () => {
    mockAdminAuth();
    mockDb.user.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    await GET_PENDING(req);

    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { approvalStatus: 'PENDING' },
        include: expect.objectContaining({ profile: true, caregiver: true }),
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('returns 500 when database throws', async () => {
    mockAdminAuth();
    mockDb.user.findMany.mockRejectedValue(new Error('DB connection failed'));

    const req = new NextRequest('http://localhost:3005/api/admin/users/pending');
    const res = await GET_PENDING(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to fetch pending users');
  });
});

// =================== POST /api/admin/users/[userId]/reset-password ===================

describe('POST /api/admin/users/[userId]/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function callResetPassword(userId: string) {
    const req = new NextRequest(
      `http://localhost:3005/api/admin/users/${userId}/reset-password`,
      { method: 'POST' }
    );
    return POST_RESET_PASSWORD(req, { params: Promise.resolve({ userId }) });
  }

  it('resets password and sends email for valid admin request', async () => {
    mockAdminSession();
    // Admin user lookup
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: 'admin-1', email: 'admin@test.com', userType: 'ADMIN' } as any)
      // Target user lookup
      .mockResolvedValueOnce({
        id: 'user-target',
        email: 'target@test.com',
        profile: { firstName: 'Target' },
      } as any);
    mockDb.user.update.mockResolvedValue({} as any);

    const res = await callResetPassword('user-target');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Password reset successfully');
    expect(body.data.email).toBe('target@test.com');
    // user.update should have been called to set the hashed password
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-target' },
        data: expect.objectContaining({ passwordHash: 'hashed-password-123' }),
      })
    );
  });

  it('rejects unauthenticated requests (no session)', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await callResetPassword('user-target');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  it('rejects non-admin users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'regular-1', email: 'user@test.com', userType: 'PARENT' },
    });
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 'regular-1',
      email: 'user@test.com',
      userType: 'PARENT',
    } as any);

    const res = await callResetPassword('user-target');

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Admin access required');
  });

  it('returns 404 when target user does not exist', async () => {
    mockAdminSession();
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: 'admin-1', email: 'admin@test.com', userType: 'ADMIN' } as any)
      .mockResolvedValueOnce(null); // target user not found

    const res = await callResetPassword('nonexistent-user');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('User not found');
  });

  it('returns 403 when session user is not found in database', async () => {
    mockAdminSession();
    mockDb.user.findUnique.mockResolvedValueOnce(null); // admin not found in DB

    const res = await callResetPassword('user-target');

    expect(res.status).toBe(403);
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockAdminSession();
    mockDb.user.findUnique.mockRejectedValue(new Error('DB crash'));

    const res = await callResetPassword('user-target');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to reset password');
  });
});
