import { vi } from 'vitest';

// Mock next-auth getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/app/api/auth/[...nextauth]/options', () => ({
  authOptions: {},
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  db: {
    babysitter: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    babysitterBooking: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    babysitterChatRoom: {
      create: vi.fn(),
    },
    platformSettings: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock database (used by stripe.ts)
vi.mock('@/lib/database', () => ({
  prisma: {
    platformSettings: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  getCommissionRate: vi.fn().mockResolvedValue(0.21),
  getStripeInstance: vi.fn().mockReturnValue({
    paymentIntents: {
      retrieve: vi.fn(),
      create: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
  }),
}));
