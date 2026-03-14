import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted() so the mock fn is available inside the vi.mock factory
const { mockFindCaregiverById } = vi.hoisted(() => ({
  mockFindCaregiverById: vi.fn(),
}));

vi.mock('@/lib/db-fallback', () => ({
  smartCaregiverOperations: {
    findCaregiverById: mockFindCaregiverById,
    searchCaregivers: vi.fn(),
    createCaregiver: vi.fn(),
  },
}));

// Mock auth-middleware for PUT/PATCH
vi.mock('@/lib/auth-middleware', () => ({
  withAuth: vi.fn(),
}));

import { GET } from '@/app/api/caregivers/[id]/route';

// ─── Test data ──────────────────────────────────────────────────────────────

function makeDatabaseCaregiver(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cg-1',
    userId: 'user-cg-1',
    hourlyRate: 28,
    experienceYears: 6,
    bio: 'Dedicated and caring babysitter with 6 years of experience.',
    languages: ['English', 'French'],
    ageGroups: ['INFANT', 'TODDLER', 'PRESCHOOL'],
    specialties: ['First Aid', 'Special Needs'],
    maxChildren: 4,
    minAge: 0,
    maxAge: 12,
    isVerified: true,
    backgroundCheck: true,
    stripeAccountId: 'acct_cg1',
    stripeOnboarded: true,
    canReceivePayments: true,
    totalBookings: 15,
    averageRating: 4.9,
    isAvailable: true,
    lastActiveAt: new Date('2026-02-17T14:00:00Z'),
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2026-02-17T14:00:00Z'),
    user: {
      id: 'user-cg-1',
      email: 'jane.smith@example.com',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '555-123-4567',
        avatar: '/photos/jane.jpg',
        city: 'Toronto',
        state: 'ON',
        latitude: 43.65,
        longitude: -79.38,
      },
    },
    services: [
      {
        id: 'svc-1',
        serviceType: 'BABYSITTING',
        rate: 28,
        description: 'Full-day and evening babysitting',
        isOffered: true,
      },
      {
        id: 'svc-2',
        serviceType: 'TUTORING',
        rate: 35,
        description: 'Math and reading tutoring',
        isOffered: true,
      },
    ],
    certifications: [
      {
        id: 'cert-1',
        type: 'FIRST_AID',
        title: 'Standard First Aid',
        issuingBody: 'Red Cross',
        issueDate: new Date('2025-01-15'),
        expirationDate: new Date('2028-01-15'),
        isVerified: true,
        certificateUrl: '/certs/first-aid.pdf',
      },
    ],
    photos: [
      {
        id: 'photo-1',
        url: '/photos/jane-profile.jpg',
        caption: 'Profile photo',
        isProfile: true,
        sortOrder: 0,
      },
    ],
    caregiverBookings: [
      {
        id: 'booking-1',
        parent: {
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        startTime: new Date('2026-02-10T09:00:00Z'),
        endTime: new Date('2026-02-10T17:00:00Z'),
        status: 'COMPLETED',
        totalAmount: 22400,
        reviews: {
          rating: 5,
          comment: 'Excellent care for our children!',
          createdAt: new Date('2026-02-11T10:00:00Z'),
        },
      },
    ],
    ...overrides,
  };
}

function makeFallbackCaregiver() {
  return {
    id: 'caregiver-fallback-1',
    name: 'Emily Davis',
    hourlyRate: 25,
    experienceYears: 5,
    bio: 'Experienced childcare provider',
    languages: ['English', 'Spanish'],
    ageGroups: ['TODDLER'],
    specialties: [],
    maxChildren: 3,
    minAge: 6,
    maxAge: 144,
    isVerified: true,
    backgroundCheck: true,
    totalBookings: 15,
    averageRating: 4.8,
    address: {
      city: 'Manhattan',
      province: 'NY',
      latitude: 40.75,
      longitude: -73.99,
    },
    services: [
      { type: 'BABYSITTING', rate: 25, description: 'Evening babysitting' },
    ],
    createdAt: '2024-01-15T00:00:00Z',
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createGetRequest(id: string) {
  return new NextRequest(`http://localhost:3005/api/caregivers/${id}`, {
    method: 'GET',
  });
}

function callGET(id: string) {
  const req = createGetRequest(id);
  return GET(req, { params: Promise.resolve({ id }) });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/caregivers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic retrieval ───────────────────────────────────────────────────

  it('returns a caregiver by ID with success response', async () => {
    const caregiver = makeDatabaseCaregiver();
    mockFindCaregiverById.mockResolvedValue(caregiver);

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.caregiver).toBeDefined();
    expect(json.data.caregiver.id).toBe('cg-1');
  });

  it('returns 404 for a non-existent caregiver', async () => {
    mockFindCaregiverById.mockResolvedValue(null);

    const res = await callGET('nonexistent-id');
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Caregiver not found');
  });

  it('calls findCaregiverById with the correct ID', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    await callGET('cg-specific-id');

    expect(mockFindCaregiverById).toHaveBeenCalledWith('cg-specific-id');
  });

  // ── Response format (database format) ─────────────────────────────────

  it('includes name derived from user profile first + last name', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.name).toBe('Jane Smith');
  });

  it('includes services with type, rate, and description', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.services).toHaveLength(2);
    expect(json.data.caregiver.services[0]).toEqual(
      expect.objectContaining({
        id: 'svc-1',
        type: 'BABYSITTING',
        rate: 28,
        description: 'Full-day and evening babysitting',
        isOffered: true,
      })
    );
  });

  it('includes reviews embedded in bookings', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.bookings).toHaveLength(1);
    expect(json.data.caregiver.bookings[0].review).toBeDefined();
    expect(json.data.caregiver.bookings[0].review.rating).toBe(5);
    expect(json.data.caregiver.bookings[0].review.comment).toBe(
      'Excellent care for our children!'
    );
    expect(json.data.caregiver.bookings[0].parentName).toBe('John Doe');
  });

  it('includes certifications in the response', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.certifications).toHaveLength(1);
    expect(json.data.caregiver.certifications[0]).toEqual(
      expect.objectContaining({
        type: 'FIRST_AID',
        title: 'Standard First Aid',
        issuingBody: 'Red Cross',
        isVerified: true,
      })
    );
  });

  it('includes photos in the response', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.photos).toHaveLength(1);
    expect(json.data.caregiver.photos[0]).toEqual(
      expect.objectContaining({
        id: 'photo-1',
        url: '/photos/jane-profile.jpg',
        isProfile: true,
      })
    );
  });

  it('includes address with city, province, and coordinates', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.address).toEqual({
      city: 'Toronto',
      province: 'ON',
      latitude: 43.65,
      longitude: -79.38,
    });
  });

  it('includes caregiver stats (totalBookings, averageRating, isAvailable)', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.totalBookings).toBe(15);
    expect(json.data.caregiver.averageRating).toBe(4.9);
    expect(json.data.caregiver.isAvailable).toBe(true);
    expect(json.data.caregiver.canReceivePayments).toBe(true);
  });

  it('does not expose PII (email, phone, streetAddress, stripeAccountId)', async () => {
    mockFindCaregiverById.mockResolvedValue(makeDatabaseCaregiver());

    const res = await callGET('cg-1');
    const json = await res.json();

    // These fields should NOT appear in the public endpoint
    expect(json.data.caregiver.email).toBeUndefined();
    expect(json.data.caregiver.phone).toBeUndefined();
    expect(json.data.caregiver.streetAddress).toBeUndefined();
    expect(json.data.caregiver.stripeAccountId).toBeUndefined();
  });

  // ── Fallback format ───────────────────────────────────────────────────

  it('handles fallback format caregivers correctly', async () => {
    mockFindCaregiverById.mockResolvedValue(makeFallbackCaregiver());

    const res = await callGET('caregiver-fallback-1');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.caregiver.id).toBe('caregiver-fallback-1');
    expect(json.data.caregiver.name).toBe('Emily Davis');
    expect(json.data.caregiver.hourlyRate).toBe(25);
    expect(json.data.caregiver.canReceivePayments).toBe(false);
  });

  it('handles bookings with no reviews', async () => {
    const caregiver = makeDatabaseCaregiver({
      caregiverBookings: [
        {
          id: 'booking-no-review',
          parent: {
            profile: { firstName: 'Alice', lastName: 'Wonder' },
          },
          startTime: new Date(),
          endTime: new Date(),
          status: 'COMPLETED',
          totalAmount: 15000,
          reviews: null,
        },
      ],
    });
    mockFindCaregiverById.mockResolvedValue(caregiver);

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(json.data.caregiver.bookings[0].review).toBeNull();
    expect(json.data.caregiver.bookings[0].parentName).toBe('Alice Wonder');
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns 500 when findCaregiverById throws an error', async () => {
    mockFindCaregiverById.mockRejectedValue(
      new Error('Database connection failed')
    );

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Failed to fetch caregiver');
  });

  it('handles caregivers with empty services, certifications, and photos', async () => {
    const caregiver = makeDatabaseCaregiver({
      services: [],
      certifications: [],
      photos: [],
      caregiverBookings: [],
    });
    mockFindCaregiverById.mockResolvedValue(caregiver);

    const res = await callGET('cg-1');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.caregiver.services).toEqual([]);
    expect(json.data.caregiver.certifications).toEqual([]);
    expect(json.data.caregiver.photos).toEqual([]);
    expect(json.data.caregiver.bookings).toEqual([]);
  });
});
