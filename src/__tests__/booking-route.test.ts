import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/babysitter/booking/route';
import { db } from '@/lib/db';
import { getCommissionRate, getStripeInstance } from '@/lib/stripe';
import { getServerSession } from 'next-auth';

const mockDb = vi.mocked(db, true);
const mockGetServerSession = vi.mocked(getServerSession);
const mockGetCommissionRate = vi.mocked(getCommissionRate);
const mockGetStripeInstance = vi.mocked(getStripeInstance);

// Helper to create a NextRequest with JSON body
function createRequest(body: object, method = 'POST') {
  return new NextRequest('http://localhost:3005/api/babysitter/booking', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper to mock a valid parent session
function mockParentSession(id = 'parent-1') {
  mockGetServerSession.mockResolvedValue({
    user: {
      id,
      email: 'parent@example.com',
      userType: 'PARENT',
      isActive: true,
      isParent: true,
      isCaregiver: false,
      isBabysitter: false,
      activeRole: 'PARENT',
      approvalStatus: 'APPROVED',
    },
  });
}

const validBookingData = {
  babysitterId: 'bs-1',
  startTime: '2026-03-01T09:00:00.000Z',
  endTime: '2026-03-01T13:00:00.000Z',
  childrenCount: 2,
  address: '123 Main St',
  city: 'Toronto',
  state: 'ON',
  zipCode: 'M5V 1A1',
  paymentMethod: 'ONSITE',
  paymentIntentId: 'pi_test_123',
};

const mockBabysitter = {
  id: 'bs-1',
  userId: 'sitter-user-1',
  status: 'APPROVED',
  isAvailable: true,
  hourlyRate: 25,
  stripeOnboarded: true,
  user: { id: 'sitter-user-1', email: 'sitter@example.com' },
};

describe('POST /api/babysitter/booking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCommissionRate.mockResolvedValue(0.21);
    mockGetStripeInstance.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({ status: 'succeeded' }),
        create: vi.fn(),
      },
      refunds: { create: vi.fn() },
    } as any);
  });

  it('rejects unauthenticated requests', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects non-PARENT users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'caregiver-1',
        email: 'cg@example.com',
        userType: 'CAREGIVER',
        isActive: true,
        isParent: false,
        isCaregiver: true,
        isBabysitter: false,
      },
    });
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects invalid body (missing fields)', async () => {
    mockParentSession();
    const req = createRequest({ babysitterId: 'bs-1' }); // missing required fields
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects booking yourself', async () => {
    mockParentSession('sitter-user-1'); // same userId as babysitter
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cannot book yourself');
  });

  it('rejects non-existent babysitter', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(null);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('rejects unapproved babysitter', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      status: 'PENDING_VERIFICATION',
    } as any);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not currently accepting');
  });

  it('rejects unavailable babysitter', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      isAvailable: false,
    } as any);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('unavailable');
  });

  it('rejects booking less than 2 hours', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    const req = createRequest({
      ...validBookingData,
      endTime: '2026-03-01T10:00:00.000Z', // only 1 hour
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Minimum booking');
  });

  it('rejects end time before start time', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    const req = createRequest({
      ...validBookingData,
      startTime: '2026-03-01T13:00:00.000Z',
      endTime: '2026-03-01T09:00:00.000Z',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('after start time');
  });

  it('rejects ONSITE booking without paymentIntentId', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitterBooking.findFirst.mockResolvedValue(null); // no conflicts
    const req = createRequest({
      ...validBookingData,
      paymentIntentId: undefined,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Platform fee payment is required');
  });

  it('rejects when Stripe payment not succeeded', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitterBooking.findFirst.mockResolvedValue(null);
    mockGetStripeInstance.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({ status: 'requires_payment_method' }),
      },
      refunds: { create: vi.fn() },
    } as any);
    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not been completed');
  });

  it('rejects conflicting bookings and refunds payment', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitterBooking.findFirst.mockResolvedValue({ id: 'existing-booking' } as any);

    const mockRefund = vi.fn().mockResolvedValue({});
    mockGetStripeInstance.mockReturnValue({
      paymentIntents: { retrieve: vi.fn() },
      refunds: { create: mockRefund },
    } as any);

    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(mockRefund).toHaveBeenCalledWith({ payment_intent: 'pi_test_123' });
  });

  it('creates booking successfully with correct pricing', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(mockBabysitter as any);
    mockDb.babysitterBooking.findFirst.mockResolvedValue(null); // no conflict
    mockDb.babysitterBooking.create.mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING',
      startTime: new Date('2026-03-01T09:00:00Z'),
      endTime: new Date('2026-03-01T13:00:00Z'),
      totalHours: 4,
      subtotal: 10000, // $25/hr * 4hr = $100 in cents
      platformFee: 2100, // 21% of $100
      totalAmount: 12100,
      babysitterPayout: 10000,
      paymentMethod: 'ONSITE',
    } as any);
    mockDb.babysitterChatRoom.create.mockResolvedValue({} as any);

    const req = createRequest(validBookingData);
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.booking.subtotal).toBe(100); // cents -> dollars
    expect(body.data.booking.platformFee).toBe(21);
    expect(body.data.booking.totalAmount).toBe(121);

    // Verify booking was created with correct data
    expect(mockDb.babysitterBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          babysitterId: 'bs-1',
          parentId: 'parent-1',
          hourlyRate: 25,
          totalHours: 4,
          subtotal: 10000,
          platformFee: 2100,
          totalAmount: 12100,
          paymentMethod: 'ONSITE',
          status: 'PENDING',
        }),
      })
    );

    // Verify chat room was created
    expect(mockDb.babysitterChatRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          parentId: 'parent-1',
          babysitterId: 'bs-1',
        }),
      })
    );
  });

  it('rejects PLATFORM payment when babysitter not Stripe onboarded', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue({
      ...mockBabysitter,
      stripeOnboarded: false,
    } as any);
    const req = createRequest({
      ...validBookingData,
      paymentMethod: 'PLATFORM',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('does not accept platform payments');
  });
});

describe('GET /api/babysitter/booking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/booking');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns bookings for parent role', async () => {
    mockParentSession();
    mockDb.babysitterBooking.findMany.mockResolvedValue([
      {
        id: 'b-1',
        status: 'COMPLETED',
        startTime: new Date(),
        endTime: new Date(),
        totalHours: 3,
        subtotal: 7500,
        platformFee: 1575,
        totalAmount: 9075,
        paymentMethod: 'ONSITE',
        childrenCount: 1,
        city: 'Toronto',
        createdAt: new Date(),
        babysitter: {
          user: { profile: { firstName: 'Jane', lastName: 'Doe', avatar: null } },
        },
        parent: {
          profile: { firstName: 'John', lastName: 'Smith', avatar: null },
        },
      },
    ] as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/booking?role=parent');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.bookings).toHaveLength(1);
    // Amounts converted from cents to dollars
    expect(body.data.bookings[0].subtotal).toBe(75);
    expect(body.data.bookings[0].platformFee).toBe(15.75);
  });

  it('returns 403 for non-babysitter accessing babysitter role', async () => {
    mockParentSession();
    mockDb.babysitter.findUnique.mockResolvedValue(null); // not a babysitter
    const req = new NextRequest('http://localhost:3005/api/babysitter/booking?role=babysitter');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns specific booking by ID', async () => {
    mockParentSession();
    mockDb.babysitterBooking.findFirst.mockResolvedValue({
      id: 'b-1',
      status: 'CONFIRMED',
      parentId: 'parent-1',
    } as any);

    const req = new NextRequest('http://localhost:3005/api/babysitter/booking?id=b-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.booking.id).toBe('b-1');
  });

  it('returns 404 for non-existent booking', async () => {
    mockParentSession();
    mockDb.babysitterBooking.findFirst.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3005/api/babysitter/booking?id=nonexistent');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
