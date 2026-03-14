import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/children/route';
import {
  GET as GET_CHILD,
  PUT as PUT_CHILD,
  DELETE as DELETE_CHILD,
} from '@/app/api/children/[childId]/route';
import { db } from '@/lib/db';

// Mock withAuth middleware
const mockWithAuth = vi.fn();
vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock security-config (transitive dependency of auth-middleware)
vi.mock('@/lib/security-config', () => ({
  SECURITY_CONFIG: { RATE_LIMITS: { AUTH_ENDPOINTS: { WINDOW_MS: 60000, REQUESTS: 100 } } },
  logSecurityEvent: vi.fn(),
}));

const mockDb = vi.mocked(db, true);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockParentAuth(id = 'parent-1', email = 'parent@test.com') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: true,
    user: {
      id,
      email,
      userType: 'PARENT',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });
}

function mockUnauthorized(status = 401, message = 'Authentication required') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: false,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

function createPostRequest(body: object) {
  return new NextRequest('http://localhost:3005/api/children', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validChildData = {
  firstName: 'Emma',
  lastName: 'Smith',
  dateOfBirth: '2020-05-15T00:00:00.000Z',
  gender: 'FEMALE',
  allergies: 'Peanuts',
  medications: null,
  medicalConditions: null,
  emergencyMedicalInfo: null,
  bloodType: null,
  emergencyContacts: null,
  dietaryRestrictions: null,
  specialInstructions: 'Early bedtime',
  pickupInstructions: null,
  photoUrl: null,
};

const mockChild = {
  id: 'child-1',
  parentId: 'parent-1',
  firstName: 'Emma',
  lastName: 'Smith',
  dateOfBirth: new Date('2020-05-15'),
  gender: 'FEMALE',
  allergies: 'Peanuts',
  createdAt: new Date(),
};

// ========================== GET /api/children ==========================

describe('GET /api/children', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns children for authenticated parent', async () => {
    mockParentAuth();
    mockDb.child.findMany.mockResolvedValue([mockChild, { ...mockChild, id: 'child-2', firstName: 'Liam' }] as any);

    const req = new NextRequest('http://localhost:3005/api/children');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('queries children with correct parentId and ordering', async () => {
    mockParentAuth('parent-42');
    mockDb.child.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3005/api/children');
    await GET(req);

    expect(mockDb.child.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: 'parent-42' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('returns empty array when parent has no children', async () => {
    mockParentAuth();
    mockDb.child.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3005/api/children');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('rejects unauthenticated requests', async () => {
    mockUnauthorized(401);

    const req = new NextRequest('http://localhost:3005/api/children');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('rejects non-parent users', async () => {
    mockUnauthorized(403, 'Insufficient permissions');

    const req = new NextRequest('http://localhost:3005/api/children');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns 500 when database throws', async () => {
    mockParentAuth();
    mockDb.child.findMany.mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost:3005/api/children');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Failed to fetch children');
  });
});

// ========================== POST /api/children ==========================

describe('POST /api/children', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a child with all fields', async () => {
    mockParentAuth();
    mockDb.child.create.mockResolvedValue({ id: 'child-new', ...validChildData, parentId: 'parent-1' } as any);

    const req = createPostRequest(validChildData);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('created successfully');
    expect(body.data.firstName).toBe('Emma');
  });

  it('passes correct data to db.child.create', async () => {
    mockParentAuth('parent-99');
    mockDb.child.create.mockResolvedValue({ id: 'child-new' } as any);

    const req = createPostRequest(validChildData);
    await POST(req);

    expect(mockDb.child.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'parent-99',
          firstName: 'Emma',
          lastName: 'Smith',
          gender: 'FEMALE',
          allergies: 'Peanuts',
          specialInstructions: 'Early bedtime',
        }),
      })
    );
  });

  it('rejects when firstName is missing', async () => {
    mockParentAuth();
    const { firstName, ...rest } = validChildData;

    const req = createPostRequest(rest);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid input');
  });

  it('rejects when lastName is missing', async () => {
    mockParentAuth();
    const { lastName, ...rest } = validChildData;

    const req = createPostRequest(rest);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid input');
  });

  it('rejects when dateOfBirth is missing', async () => {
    mockParentAuth();
    const { dateOfBirth, ...rest } = validChildData;

    const req = createPostRequest(rest);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects unauthenticated requests', async () => {
    mockUnauthorized(401);

    const req = createPostRequest(validChildData);
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 500 when database create throws', async () => {
    mockParentAuth();
    mockDb.child.create.mockRejectedValue(new Error('Unique constraint violation'));

    const req = createPostRequest(validChildData);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Failed to create child profile');
  });
});

// ==================== GET /api/children/[childId] ====================

describe('GET /api/children/[childId]', () => {
  beforeEach(() => vi.clearAllMocks());

  function callGetChild(childId: string) {
    const req = new NextRequest(`http://localhost:3005/api/children/${childId}`);
    return GET_CHILD(req, { params: Promise.resolve({ childId }) });
  }

  it('returns a specific child for the authenticated parent', async () => {
    mockParentAuth();
    mockDb.child.findFirst.mockResolvedValue(mockChild as any);

    const res = await callGetChild('child-1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('child-1');
  });

  it('returns 404 when child does not belong to parent', async () => {
    mockParentAuth();
    mockDb.child.findFirst.mockResolvedValue(null);

    const res = await callGetChild('child-other');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('rejects unauthenticated requests', async () => {
    mockUnauthorized(401);

    const res = await callGetChild('child-1');

    expect(res.status).toBe(401);
  });
});

// ==================== DELETE /api/children/[childId] ====================

describe('DELETE /api/children/[childId]', () => {
  beforeEach(() => vi.clearAllMocks());

  function callDeleteChild(childId: string) {
    const req = new NextRequest(`http://localhost:3005/api/children/${childId}`, { method: 'DELETE' });
    return DELETE_CHILD(req, { params: Promise.resolve({ childId }) });
  }

  it('deletes a child successfully', async () => {
    mockParentAuth();
    mockDb.child.findFirst.mockResolvedValue(mockChild as any);
    mockDb.booking.count.mockResolvedValue(0 as any);
    // checkInOut is not in setup mock, so mock it on the fly
    (mockDb as any).checkInOut = { count: vi.fn().mockResolvedValue(0) };
    mockDb.child.delete.mockResolvedValue(mockChild as any);

    const res = await callDeleteChild('child-1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('deleted successfully');
  });

  it('returns 404 when child does not exist or belongs to another parent', async () => {
    mockParentAuth();
    mockDb.child.findFirst.mockResolvedValue(null);

    const res = await callDeleteChild('child-unknown');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('rejects deletion when child has active bookings', async () => {
    mockParentAuth();
    mockDb.child.findFirst.mockResolvedValue(mockChild as any);
    mockDb.booking.count.mockResolvedValue(2 as any);
    (mockDb as any).checkInOut = { count: vi.fn().mockResolvedValue(0) };

    const res = await callDeleteChild('child-1');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('active bookings');
  });
});
