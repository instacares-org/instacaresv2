import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted ensures these exist before vi.mock factories run)
// ---------------------------------------------------------------------------
const {
  mockWithAuth,
  mockGetAuthenticatedUser,
  mockPrismaChatRoom,
  mockPrismaBooking,
} = vi.hoisted(() => ({
  mockWithAuth: vi.fn(),
  mockGetAuthenticatedUser: vi.fn(),
  mockPrismaChatRoom: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  mockPrismaBooking: {
    findUnique: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock withAuth (used by /api/chat/rooms)
vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

vi.mock('@/lib/security-config', () => ({
  SECURITY_CONFIG: { RATE_LIMITS: { AUTH_ENDPOINTS: { WINDOW_MS: 60000, REQUESTS: 100 } } },
  logSecurityEvent: vi.fn(),
}));

// Mock cache module (used by /api/chat/rooms)
vi.mock('@/lib/cache', () => ({
  apiCache: {
    get: vi.fn().mockReturnValue(null), // always cache miss by default
    set: vi.fn(),
  },
  cacheKeys: {
    chatRooms: vi.fn().mockReturnValue('chat-rooms:test'),
  },
  cacheTTL: {
    chatRooms: 120,
  },
}));

// Mock getAuthenticatedUser and helpers (used by /api/chat/conversations)
vi.mock('@/lib/chatAuth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  createApiResponse: vi.fn((success: boolean, data?: unknown, error?: string, status = 200) => {
    return Response.json(
      {
        success,
        data: success ? data : undefined,
        error: success ? undefined : error,
      },
      { status }
    );
  }),
  formatUserInfo: vi.fn((user: any) => ({
    id: user.id,
    firstName: user.profile?.firstName || '',
    lastName: user.profile?.lastName || '',
    profileImage: '',
    userType: user.userType,
  })),
}));

// Mock @/lib/db prisma (used by conversations route)
vi.mock('@/lib/db', () => ({
  db: {
    chatRoom: mockPrismaChatRoom,
    booking: mockPrismaBooking,
    platformSettings: { findFirst: vi.fn().mockResolvedValue(null) },
  },
  prisma: {
    chatRoom: mockPrismaChatRoom,
    booking: mockPrismaBooking,
    platformSettings: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

// ---------------------------------------------------------------------------
// Imports that depend on mocks (must come after vi.mock calls)
// ---------------------------------------------------------------------------
import { GET as GET_ROOMS } from '@/app/api/chat/rooms/route';
import { GET as GET_CONVERSATIONS, POST as POST_CONVERSATION } from '@/app/api/chat/conversations/route';

const mockDb = vi.mocked(db, true);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthParent(id = 'parent-1') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: true,
    user: {
      id,
      email: 'parent@test.com',
      userType: 'PARENT',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });
}

function mockAuthCaregiver(id = 'cg-1') {
  mockWithAuth.mockResolvedValue({
    isAuthorized: true,
    user: {
      id,
      email: 'cg@test.com',
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      isActive: true,
    },
  });
}

function mockRoomsUnauthorized(status = 401) {
  mockWithAuth.mockResolvedValue({
    isAuthorized: false,
    response: new Response(JSON.stringify({ error: 'Authentication required' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

// Sample chat room from the DB (matches the include shape the route expects)
function buildMockRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    isActive: true,
    lastMessageAt: new Date(),
    booking: {
      id: 'booking-1',
      startTime: new Date(),
      endTime: new Date(),
      status: 'CONFIRMED',
      address: '123 Main St',
      childrenCount: 2,
      parent: {
        id: 'parent-1',
        email: 'parent@test.com',
        profile: { firstName: 'John', lastName: 'Doe', phone: '555-1234', avatar: null },
      },
      caregiverUser: {
        id: 'cg-1',
        email: 'cg@test.com',
        profile: { firstName: 'Jane', lastName: 'Smith', phone: '555-5678', avatar: null },
      },
    },
    messages: [
      {
        id: 'msg-1',
        content: 'Hello!',
        createdAt: new Date(),
        senderId: 'parent-1',
        sender: { userType: 'PARENT' },
      },
    ],
    _count: { messages: 1 },
    ...overrides,
  };
}

// ========================== GET /api/chat/rooms ==========================

describe('GET /api/chat/rooms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns formatted chat rooms for a parent', async () => {
    mockAuthParent();
    mockDb.chatRoom.findMany.mockResolvedValue([buildMockRoom()] as any);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('room-1');
    expect(body.data[0].booking.id).toBe('booking-1');
    expect(body.data[0].lastMessage.content).toBe('Hello!');
    expect(body.data[0].unreadCount).toBe(1);
  });

  it('returns rooms for a caregiver using caregiverId where clause', async () => {
    mockAuthCaregiver('cg-1');
    mockDb.chatRoom.findMany.mockResolvedValue([buildMockRoom()] as any);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    await GET_ROOMS(req);

    expect(mockDb.chatRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caregiverId: 'cg-1',
          isActive: true,
        }),
      })
    );
  });

  it('filters out rooms without bookings', async () => {
    mockAuthParent();
    const roomWithNoBooking = { ...buildMockRoom(), booking: null };
    mockDb.chatRoom.findMany.mockResolvedValue([buildMockRoom(), roomWithNoBooking] as any);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1); // only the room with booking
  });

  it('returns empty array when no rooms exist', async () => {
    mockAuthParent();
    mockDb.chatRoom.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('handles room with no messages (lastMessage is null)', async () => {
    mockAuthParent();
    const roomNoMessages = buildMockRoom({ messages: [], _count: { messages: 0 } });
    mockDb.chatRoom.findMany.mockResolvedValue([roomNoMessages] as any);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data[0].lastMessage).toBeNull();
    expect(body.data[0].unreadCount).toBe(0);
  });

  it('rejects unauthenticated requests', async () => {
    mockRoomsUnauthorized(401);

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    expect(res!.status).toBe(401);
  });

  it('returns empty array when database throws (graceful fallback)', async () => {
    mockAuthParent();
    mockDb.chatRoom.findMany.mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost:3005/api/chat/rooms');
    const res = await GET_ROOMS(req);

    // The route catches DB errors and returns an empty array wrapped in apiSuccess
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

// ================== GET /api/chat/conversations ====================

describe('GET /api/chat/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conversations for authenticated parent', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
      profile: { firstName: 'John', lastName: 'Doe' },
    });

    mockPrismaChatRoom.findMany.mockResolvedValue([
      {
        id: 'room-1',
        bookingId: 'booking-1',
        parentId: 'parent-1',
        caregiverId: 'cg-1',
        isActive: true,
        lastMessageAt: new Date(),
        booking: { id: 'booking-1', startTime: new Date(), endTime: new Date(), status: 'CONFIRMED', address: '123 St', childrenCount: 1 },
        parent: { id: 'parent-1', email: 'parent@test.com', profile: { firstName: 'John', lastName: 'Doe', avatar: null } },
        caregiver: { id: 'cg-1', email: 'cg@test.com', profile: { firstName: 'Jane', lastName: 'Smith', avatar: null } },
        messages: [],
        _count: { messages: 0 },
      },
    ]);

    const req = new NextRequest('http://localhost:3005/api/chat/conversations');
    const res = await GET_CONVERSATIONS(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].otherUser.firstName).toBe('Jane');
  });

  it('rejects unauthenticated requests', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3005/api/chat/conversations');
    const res = await GET_CONVERSATIONS(req);

    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.success).toBe(false);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
    });
    mockPrismaChatRoom.findMany.mockRejectedValue(new Error('DB crash'));

    const req = new NextRequest('http://localhost:3005/api/chat/conversations');
    const res = await GET_CONVERSATIONS(req);

    expect(res!.status).toBe(500);
  });
});

// ================== POST /api/chat/conversations ====================

describe('POST /api/chat/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  function createConversationRequest(body: object) {
    return new NextRequest('http://localhost:3005/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('creates a new conversation for a valid booking', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
    });

    mockPrismaBooking.findUnique.mockResolvedValue({
      id: 'booking-1',
      parentId: 'parent-1',
      caregiverId: 'cg-1',
      status: 'CONFIRMED',
    });

    // No existing chat room
    mockPrismaChatRoom.findUnique.mockResolvedValue(null);

    // Create new chat room
    mockPrismaChatRoom.create.mockResolvedValue({
      id: 'room-new',
      bookingId: 'booking-1',
      parentId: 'parent-1',
      caregiverId: 'cg-1',
      isActive: true,
      lastMessageAt: null,
      parent: { id: 'parent-1', profile: { firstName: 'John', lastName: 'Doe', avatar: null } },
      caregiver: { id: 'cg-1', profile: { firstName: 'Jane', lastName: 'Smith', avatar: null } },
      booking: { id: 'booking-1', startTime: new Date(), endTime: new Date(), status: 'CONFIRMED', address: '123 St', childrenCount: 1 },
    });

    const req = createConversationRequest({ bookingId: 'booking-1', otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('room-new');
    expect(body.data.otherUser.firstName).toBe('Jane');
  });

  it('returns existing conversation if one already exists', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
    });

    mockPrismaBooking.findUnique.mockResolvedValue({
      id: 'booking-1',
      parentId: 'parent-1',
      caregiverId: 'cg-1',
      status: 'CONFIRMED',
    });

    mockPrismaChatRoom.findUnique.mockResolvedValue({
      id: 'room-existing',
      bookingId: 'booking-1',
      parentId: 'parent-1',
      caregiverId: 'cg-1',
      isActive: true,
      lastMessageAt: new Date(),
      parent: { id: 'parent-1', profile: { firstName: 'John', lastName: 'Doe', avatar: null } },
      caregiver: { id: 'cg-1', profile: { firstName: 'Jane', lastName: 'Smith', avatar: null } },
      booking: { id: 'booking-1', startTime: new Date(), endTime: new Date(), status: 'CONFIRMED', address: '123 St', childrenCount: 1 },
    });

    const req = createConversationRequest({ bookingId: 'booking-1', otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.data.id).toBe('room-existing');
    // create should NOT have been called
    expect(mockPrismaChatRoom.create).not.toHaveBeenCalled();
  });

  it('rejects when bookingId is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
    });

    const req = createConversationRequest({ otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toBe('Invalid input');
  });

  it('returns 404 when booking does not exist', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'parent-1',
      email: 'parent@test.com',
      userType: 'PARENT',
    });
    mockPrismaBooking.findUnique.mockResolvedValue(null);

    const req = createConversationRequest({ bookingId: 'booking-nonexistent', otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(404);
  });

  it('rejects when user is not a participant of the booking', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'intruder-1',
      email: 'intruder@test.com',
      userType: 'PARENT',
    });
    mockPrismaBooking.findUnique.mockResolvedValue({
      id: 'booking-1',
      parentId: 'parent-1',
      caregiverId: 'cg-1',
      status: 'CONFIRMED',
    });

    const req = createConversationRequest({ bookingId: 'booking-1', otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain('Access denied');
  });

  it('rejects unauthenticated requests', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const req = createConversationRequest({ bookingId: 'booking-1', otherUserId: 'cg-1' });
    const res = await POST_CONVERSATION(req);

    expect(res!.status).toBe(401);
  });
});
