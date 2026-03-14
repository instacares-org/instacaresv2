import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// The route imports authOptions from '@/app/api/auth/[...nextauth]/options'.
// Mock that module so the route gets a stub authOptions during tests:
vi.mock('@/app/api/auth/[...nextauth]/options', () => ({
  authOptions: {},
}));

import { GET, PATCH, DELETE } from '@/app/api/notifications/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

const mockDb = vi.mocked(db, true);
const mockGetServerSession = vi.mocked(getServerSession);

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockSession(userId = 'user-1') {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: userId,
      email: 'user@example.com',
      userType: 'PARENT',
    },
  } as any);
}

function mockNoSession() {
  mockGetServerSession.mockResolvedValue(null);
}

function createGetRequest() {
  return new NextRequest('http://localhost:3005/api/notifications', {
    method: 'GET',
  });
}

function createPatchRequest(body: object) {
  return new NextRequest('http://localhost:3005/api/notifications', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createDeleteRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3005/api/notifications');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: 'DELETE' });
}

// ─── Notification fixtures ──────────────────────────────────────────────────

const mockNotifications = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed',
    message: 'Your booking with Jane has been confirmed.',
    isRead: false,
    resourceType: 'BOOKING',
    resourceId: 'booking-1',
    createdAt: new Date('2026-02-18T10:00:00Z'),
    readAt: null,
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'NEW_MESSAGE',
    title: 'New Message',
    message: 'You have a new message from Jane.',
    isRead: true,
    resourceType: 'CHAT',
    resourceId: 'chat-1',
    createdAt: new Date('2026-02-17T14:00:00Z'),
    readAt: new Date('2026-02-17T15:00:00Z'),
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'REVIEW_RECEIVED',
    title: 'New Review',
    message: 'You received a 5-star review!',
    isRead: false,
    resourceType: 'REVIEW',
    resourceId: 'review-1',
    createdAt: new Date('2026-02-16T09:00:00Z'),
    readAt: null,
  },
];

// ─── GET /api/notifications ─────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockNoSession();

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns notifications for the authenticated user', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockResolvedValue(mockNotifications as any);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.notifications).toHaveLength(3);
  });

  it('queries only the current user notifications', async () => {
    mockSession('user-42');
    mockDb.notification.findMany.mockResolvedValue([]);

    const req = createGetRequest();
    await GET(req);

    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-42' },
      })
    );
  });

  it('orders notifications by createdAt descending', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockResolvedValue([]);

    const req = createGetRequest();
    await GET(req);

    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('limits results to 50 recent notifications', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockResolvedValue([]);

    const req = createGetRequest();
    await GET(req);

    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it('formats notification response with correct fields', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockResolvedValue([mockNotifications[0]] as any);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    const notif = json.data.notifications[0];
    expect(notif.id).toBe('notif-1');
    expect(notif.type).toBe('BOOKING_CONFIRMED');
    expect(notif.title).toBe('Booking Confirmed');
    expect(notif.message).toBe('Your booking with Jane has been confirmed.');
    expect(notif.isRead).toBe(false);
    expect(notif.resourceType).toBe('BOOKING');
    expect(notif.resourceId).toBe('booking-1');
    expect(notif.timestamp).toBeDefined();
    expect(notif.readAt).toBeNull();
  });

  it('returns an empty array when the user has no notifications', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockResolvedValue([]);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.notifications).toEqual([]);
  });

  it('returns 500 when the database query fails', async () => {
    mockSession('user-1');
    mockDb.notification.findMany.mockRejectedValue(new Error('DB error'));

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to fetch notifications');
  });
});

// ─── PATCH /api/notifications ───────────────────────────────────────────────

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockNoSession();

    const req = createPatchRequest({ notificationId: 'notif-1' });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('marks a single notification as read', async () => {
    mockSession('user-1');

    // Mock finding the notification (ownership check)
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
    } as any);

    mockDb.notification.update.mockResolvedValue({} as any);

    const req = createPatchRequest({ notificationId: 'notif-1' });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    expect(mockDb.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          isRead: true,
        }),
      })
    );
  });

  it('marks all notifications as read when markAllAsRead is true', async () => {
    mockSession('user-1');
    mockDb.notification.updateMany.mockResolvedValue({ count: 5 } as any);

    const req = createPatchRequest({ markAllAsRead: true });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    expect(mockDb.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          isRead: false,
        },
        data: expect.objectContaining({
          isRead: true,
        }),
      })
    );
  });

  it('returns 404 when notification does not exist', async () => {
    mockSession('user-1');
    mockDb.notification.findUnique.mockResolvedValue(null);

    const req = createPatchRequest({ notificationId: 'nonexistent' });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Notification not found');
  });

  it('returns 403 when trying to mark another user notification as read (IDOR protection)', async () => {
    mockSession('user-1');

    // Notification belongs to a different user
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'notif-other',
      userId: 'user-other',
    } as any);

    const req = createPatchRequest({ notificationId: 'notif-other' });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('Unauthorized');
    // Should NOT have called update
    expect(mockDb.notification.update).not.toHaveBeenCalled();
  });

  it('returns 400 when neither notificationId nor markAllAsRead is provided', async () => {
    mockSession('user-1');

    const req = createPatchRequest({});
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns 500 when the database update fails', async () => {
    mockSession('user-1');
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
    } as any);
    mockDb.notification.update.mockRejectedValue(new Error('DB write error'));

    const req = createPatchRequest({ notificationId: 'notif-1' });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to update notifications');
  });
});

// ─── DELETE /api/notifications ──────────────────────────────────────────────

describe('DELETE /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockNoSession();

    const req = createDeleteRequest({ id: 'notif-1' });
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('deletes a single notification by ID', async () => {
    mockSession('user-1');
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
    } as any);
    mockDb.notification.delete.mockResolvedValue({} as any);

    const req = createDeleteRequest({ id: 'notif-1' });
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    expect(mockDb.notification.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1' },
      })
    );
  });

  it('deletes all notifications when deleteAll=true', async () => {
    mockSession('user-1');
    mockDb.notification.deleteMany.mockResolvedValue({ count: 10 } as any);

    const req = createDeleteRequest({ deleteAll: 'true' });
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    expect(mockDb.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      })
    );
  });

  it('returns 404 when notification to delete does not exist', async () => {
    mockSession('user-1');
    mockDb.notification.findUnique.mockResolvedValue(null);

    const req = createDeleteRequest({ id: 'nonexistent' });
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Notification not found');
  });

  it('returns 403 when trying to delete another user notification (IDOR protection)', async () => {
    mockSession('user-1');
    mockDb.notification.findUnique.mockResolvedValue({
      id: 'notif-other',
      userId: 'user-other',
    } as any);

    const req = createDeleteRequest({ id: 'notif-other' });
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('Unauthorized');
    expect(mockDb.notification.delete).not.toHaveBeenCalled();
  });

  it('returns 400 when no id or deleteAll parameter is provided', async () => {
    mockSession('user-1');

    const req = createDeleteRequest({});
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });
});
