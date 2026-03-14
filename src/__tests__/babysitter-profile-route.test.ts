import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/babysitter/profile/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

const mockDb = vi.mocked(db, true);
const mockGetServerSession = vi.mocked(getServerSession);

function mockSession(overrides: Record<string, unknown> = {}) {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'sitter@example.com',
      userType: 'PARENT',
      isActive: true,
      isParent: true,
      isBabysitter: true,
      activeRole: 'PARENT',
      approvalStatus: 'APPROVED',
      ...overrides,
    },
  });
}

const mockBabysitter = {
  id: 'bs-1',
  userId: 'user-1',
  status: 'APPROVED',
  isAvailable: true,
  hourlyRate: 25,
  bio: 'Experienced babysitter',
  experienceYears: 5,
  stripeOnboarded: false,
  governmentIdFront: 'https://example.com/id.jpg',
  selfieForMatch: 'https://example.com/selfie.jpg',
  policeCheck: 'https://example.com/check.pdf',
  cprCertificate: null,
  user: {
    id: 'user-1',
    email: 'sitter@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Doe',
      avatar: null,
      city: 'Toronto',
      state: 'ON',
    },
  },
  references: [],
  reviews: [],
};

describe('GET /api/babysitter/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns public profile by babysitter ID (no auth required)', async () => {
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      experienceSummary: 'Great with kids',
      maxChildren: 4,
      ageGroupsServed: ['toddler', 'preschool'],
      totalBookings: 10,
      averageRating: 4.8,
      acceptsOnsitePayment: true,
      phoneVerified: true,
      eceCertificate: null,
      reviews: [],
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/profile?id=bs-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('bs-1');
    expect(body.data.firstName).toBe('Jane');
    expect(body.data.hourlyRate).toBe(25);
    expect(body.data.trustBadges).toBeDefined();
    expect(body.data.trustBadges.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent babysitter ID', async () => {
    mockDb.babysitter.findUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile?id=nonexistent');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unapproved babysitter public profile', async () => {
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      status: 'PENDING_VERIFICATION',
    } as any);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile?id=bs-1');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns own profile when no ID (requires auth)', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      user: { ...mockBabysitter.user, profile: { firstName: 'Jane', lastName: 'Doe' } },
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/profile');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 401 for own profile without auth', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no babysitter profile', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/babysitter/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('updates profile successfully', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitter.update.mockResolvedValue({
      ...mockBabysitter,
      hourlyRate: 30,
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Profile updated successfully');
  });

  it('rejects invalid hourly rate (too low)', async () => {
    mockSession();
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid hourly rate (too high)', async () => {
    mockSession();
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate: 200 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('rejects bio that is too short', async () => {
    mockSession();
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ bio: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when user has no babysitter profile', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it('updates availability toggle', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitter.update.mockResolvedValue({
      ...mockBabysitter,
      isAvailable: false,
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it('updates onsite payment setting', async () => {
    mockSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitter.update.mockResolvedValue({
      ...mockBabysitter,
      acceptsOnsitePayment: false,
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/profile', {
      method: 'PATCH',
      body: JSON.stringify({ acceptsOnsitePayment: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});
