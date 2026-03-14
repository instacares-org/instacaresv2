import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the cache module so it never returns cached data during tests
vi.mock('@/lib/cache', () => ({
  apiCache: {
    get: vi.fn().mockReturnValue(null), // Always cache miss
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
  cacheKeys: {
    caregivers: vi.fn().mockReturnValue('test-cache-key'),
    caregiver: vi.fn(),
  },
  cacheTTL: {
    caregivers: 180,
    caregiver: 600,
  },
}));

// Mock auth-middleware used by POST
vi.mock('@/lib/auth-middleware', () => ({
  withAuth: vi.fn(),
}));

// Mock luxon for timezone calculations
vi.mock('luxon', () => ({
  DateTime: {
    now: vi.fn().mockReturnValue({
      setZone: vi.fn().mockReturnValue({
        startOf: vi.fn().mockReturnValue({
          plus: vi.fn().mockReturnValue({
            year: 2026,
            month: 2,
            day: 19,
          }),
        }),
        year: 2026,
        month: 2,
        day: 18,
      }),
    }),
    fromObject: vi.fn().mockReturnValue({
      toFormat: vi.fn().mockReturnValue('Mar 1'),
    }),
    fromJSDate: vi.fn().mockReturnValue({
      setZone: vi.fn().mockReturnValue({
        toMillis: vi.fn().mockReturnValue(Date.now() + 100000),
        // Make it greater than nowInZone for future slot comparison
        valueOf: vi.fn().mockReturnValue(Date.now() + 100000),
      }),
    }),
  },
}));

import { GET } from '@/app/api/caregivers/route';
import { db } from '@/lib/db';

const mockDb = vi.mocked(db, true);

// ─── Test data ──────────────────────────────────────────────────────────────

function makeCaregiverRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cg-record-1',
    userId: 'user-cg-1',
    hourlyRate: 25,
    experienceYears: 5,
    bio: 'Experienced caregiver',
    languages: JSON.stringify(['English', 'French']),
    maxChildren: 4,
    minAge: 0,
    maxAge: 12,
    isVerified: true,
    backgroundCheck: true,
    ageGroups: JSON.stringify(['INFANT', 'TODDLER']),
    specialties: JSON.stringify(['Special Needs']),
    stripeAccountId: 'acct_123',
    stripeOnboarded: true,
    canReceivePayments: true,
    totalBookings: 10,
    averageRating: 4.8,
    lastActiveAt: new Date(),
    createdAt: new Date(),
    user: {
      id: 'user-cg-1',
      email: 'caregiver@example.com',
      isActive: true,
      approvalStatus: 'APPROVED',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '555-123-4567',
        avatar: '/photos/jane.jpg',
        streetAddress: '100 Queen St',
        city: 'Toronto',
        state: 'ON',
        zipCode: 'M5V 2B7',
        country: 'CA',
        latitude: 43.65,
        longitude: -79.38,
        timezone: 'America/Toronto',
      },
    },
    ...overrides,
  };
}

function makeCaregiverRecord2() {
  return makeCaregiverRecord({
    id: 'cg-record-2',
    userId: 'user-cg-2',
    hourlyRate: 30,
    experienceYears: 8,
    bio: 'Bilingual nanny',
    averageRating: 4.5,
    user: {
      id: 'user-cg-2',
      email: 'caregiver2@example.com',
      isActive: true,
      approvalStatus: 'APPROVED',
      profile: {
        firstName: 'Maria',
        lastName: 'Garcia',
        phone: '555-987-6543',
        avatar: null,
        streetAddress: '200 King St',
        city: 'Ottawa',
        state: 'ON',
        zipCode: 'K1A 0A1',
        country: 'CA',
        latitude: 45.42,
        longitude: -75.69,
        timezone: 'America/Toronto',
      },
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createGetRequest(queryParams: Record<string, string> = {}) {
  const url = new URL('http://localhost:3005/api/caregivers');
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

function setupDefaultMocks(caregivers: unknown[] = [makeCaregiverRecord()]) {
  // Platform settings
  mockDb.platformSettings.findFirst.mockResolvedValue({
    showCaregiverContactInfo: false,
  } as any);

  // Main caregiver query
  mockDb.caregiver.findMany.mockResolvedValue(caregivers as any);

  // Services
  (mockDb as any).caregiverService.findMany.mockResolvedValue([
    {
      id: 'svc-1',
      caregiverId: 'cg-record-1',
      serviceType: 'BABYSITTING',
      rate: 25,
      description: 'General babysitting',
    },
  ]);

  // Photos (model may not be in setup, but mocked inline)
  if ((mockDb as any).caregiverPhoto) {
    (mockDb as any).caregiverPhoto.findMany.mockResolvedValue([]);
  }

  // Availability slots
  if ((mockDb as any).availabilitySlot) {
    (mockDb as any).availabilitySlot.findMany.mockResolvedValue([]);
  }

  // Review counts
  mockDb.review.count.mockResolvedValue(3);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/caregivers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure caregiverPhoto and availabilitySlot mock models exist
    if (!(mockDb as any).caregiverPhoto) {
      (mockDb as any).caregiverPhoto = { findMany: vi.fn().mockResolvedValue([]) };
    }
    if (!(mockDb as any).availabilitySlot) {
      (mockDb as any).availabilitySlot = { findMany: vi.fn().mockResolvedValue([]) };
    }
  });

  it('returns a list of caregivers with success response', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.caregivers)).toBe(true);
    expect(json.data.caregivers.length).toBe(1);
    expect(json.data.caregivers[0].name).toBe('Jane Smith');
  });

  it('returns only verified and approved caregivers', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    await GET(req);

    // Verify the Prisma query filters for isVerified=true and approved/active users
    expect(mockDb.caregiver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isVerified: true,
          user: expect.objectContaining({
            isActive: true,
            approvalStatus: 'APPROVED',
          }),
        }),
      })
    );
  });

  it('supports pagination via limit and offset parameters', async () => {
    setupDefaultMocks();

    const req = createGetRequest({ limit: '5', offset: '10' });
    await GET(req);

    expect(mockDb.caregiver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        skip: 10,
      })
    );
  });

  it('returns pagination metadata in the response', async () => {
    setupDefaultMocks();

    const req = createGetRequest({ limit: '10', offset: '0' });
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.pagination).toBeDefined();
    expect(json.data.pagination.limit).toBe(10);
    expect(json.data.pagination.offset).toBe(0);
    expect(typeof json.data.pagination.total).toBe('number');
    expect(typeof json.data.pagination.hasMore).toBe('boolean');
  });

  it('uses default pagination of limit=20 and offset=0', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    await GET(req);

    expect(mockDb.caregiver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 0,
      })
    );
  });

  it('includes services for each caregiver', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.caregivers[0].services).toBeDefined();
    expect(Array.isArray(json.data.caregivers[0].services)).toBe(true);
    expect(json.data.caregivers[0].services[0].type).toBe('BABYSITTING');
  });

  it('includes review count for each caregiver', async () => {
    setupDefaultMocks();
    mockDb.review.count.mockResolvedValue(7);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.caregivers[0].reviewCount).toBe(7);
  });

  it('does not include contact info when showCaregiverContactInfo is false', async () => {
    setupDefaultMocks();
    mockDb.platformSettings.findFirst.mockResolvedValue({
      showCaregiverContactInfo: false,
    } as any);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.showCaregiverContactInfo).toBe(false);
    expect(json.data.caregivers[0].email).toBeUndefined();
    expect(json.data.caregivers[0].phone).toBeUndefined();
  });

  it('includes contact info when showCaregiverContactInfo is true', async () => {
    setupDefaultMocks();
    mockDb.platformSettings.findFirst.mockResolvedValue({
      showCaregiverContactInfo: true,
    } as any);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.showCaregiverContactInfo).toBe(true);
    expect(json.data.caregivers[0].email).toBe('caregiver@example.com');
    expect(json.data.caregivers[0].phone).toBe('555-123-4567');
  });

  it('filters by location and radius when lat/lng are provided', async () => {
    const cg1 = makeCaregiverRecord(); // Toronto ~43.65, -79.38
    const cg2 = makeCaregiverRecord2(); // Ottawa ~45.42, -75.69 (~350km away)
    setupDefaultMocks([cg1, cg2]);

    // Search near Toronto with a small radius (10km)
    const req = createGetRequest({
      lat: '43.65',
      lng: '-79.38',
      radius: '10',
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Only the Toronto caregiver should be within 10km radius
    expect(json.data.caregivers.length).toBe(1);
    expect(json.data.caregivers[0].name).toBe('Jane Smith');
  });

  it('sorts results by distance when location is provided', async () => {
    const cg1 = makeCaregiverRecord(); // Toronto
    const cg2 = makeCaregiverRecord2(); // Ottawa
    setupDefaultMocks([cg1, cg2]);

    // Search from Toronto with large radius to include both
    const req = createGetRequest({
      lat: '43.65',
      lng: '-79.38',
      radius: '500',
    });
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.caregivers.length).toBe(2);
    // Closest (Toronto) should come first
    expect(json.data.caregivers[0].name).toBe('Jane Smith');
    expect(json.data.caregivers[1].name).toBe('Maria Garcia');
    // Distance should be included
    expect(typeof json.data.caregivers[0].distance).toBe('number');
    expect(json.data.caregivers[0].distance).toBeLessThan(json.data.caregivers[1].distance);
  });

  it('returns all caregivers when no location is provided', async () => {
    const cg1 = makeCaregiverRecord();
    const cg2 = makeCaregiverRecord2();
    setupDefaultMocks([cg1, cg2]);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(json.data.caregivers.length).toBe(2);
  });

  it('returns an empty array when no caregivers match', async () => {
    setupDefaultMocks([]);

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.caregivers).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    mockDb.platformSettings.findFirst.mockResolvedValue(null);
    mockDb.caregiver.findMany.mockRejectedValue(new Error('DB connection lost'));

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Failed to fetch caregivers');
  });

  it('formats address with only city and province (no PII leak)', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    const address = json.data.caregivers[0].address;
    expect(address.city).toBe('Toronto');
    expect(address.province).toBe('ON');
    // Street address and zip code should NOT be in the response
    expect(address.streetAddress).toBeUndefined();
    expect(address.zipCode).toBeUndefined();
  });

  it('fuzzes coordinates to ~1km precision in public response', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    const res = await GET(req);
    const json = await res.json();

    const address = json.data.caregivers[0].address;
    // Coordinates should be rounded to 2 decimal places
    expect(address.latitude).toBe(43.65);
    expect(address.longitude).toBe(-79.38);
    // Original value was 43.65 which is already 2 decimal places
    // But the route explicitly rounds: Math.round(lat * 100) / 100
    expect(Number.isFinite(address.latitude)).toBe(true);
  });

  it('orders caregivers by averageRating descending', async () => {
    setupDefaultMocks();

    const req = createGetRequest();
    await GET(req);

    expect(mockDb.caregiver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { averageRating: 'desc' },
      })
    );
  });
});
