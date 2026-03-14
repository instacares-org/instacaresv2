import { vi } from 'vitest';

// Mock Redis client — tests always use in-memory fallback
vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

// Mock rate-limit module so tests bypass rate limiting
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  RATE_LIMIT_CONFIGS: {
    LOGIN: { requests: 20, window: 900000 },
    SIGNUP: { requests: 3, window: 3600000 },
    PASSWORD_RESET: { requests: 3, window: 3600000 },
    BOOKING: { requests: 10, window: 300000 },
    PAYMENT: { requests: 5, window: 600000 },
    PROFILE_UPDATE: { requests: 10, window: 900000 },
    API_READ: { requests: 100, window: 60000 },
    API_WRITE: { requests: 30, window: 60000 },
    GENERAL: { requests: 300, window: 60000 },
  },
  createRateLimitHeaders: vi.fn().mockReturnValue({}),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  defaultKeyGenerator: vi.fn().mockReturnValue('test-key'),
  createRateLimitMiddleware: vi.fn(),
  cleanupRateLimitStore: vi.fn(),
  startRateLimitCleanup: vi.fn(),
  stopRateLimitCleanup: vi.fn(),
}));

// Mock next-auth getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/app/api/auth/[...nextauth]/options', () => ({
  authOptions: {},
}));

// Helper to create a mock Prisma model with common methods
function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
    groupBy: vi.fn(),
  };
}

// Mock Prisma - comprehensive model coverage
vi.mock('@/lib/db', () => ({
  db: {
    user: createMockModel(),
    profile: createMockModel(),
    userProfile: createMockModel(),
    caregiver: createMockModel(),
    caregiverProfile: createMockModel(),
    caregiverService: createMockModel(),
    babysitter: createMockModel(),
    babysitterBooking: createMockModel(),
    babysitterChatRoom: createMockModel(),
    babysitterDocument: createMockModel(),
    babysitterReference: createMockModel(),
    booking: createMockModel(),
    payment: createMockModel(),
    review: createMockModel(),
    chatRoom: createMockModel(),
    chatMessage: createMockModel(),
    child: createMockModel(),
    notification: createMockModel(),
    availability: createMockModel(),
    platformSettings: createMockModel(),
    stripeConnectAccount: createMockModel(),
    payout: createMockModel(),
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({})),
    $queryRaw: vi.fn(),
  },
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  searchCaregivers: vi.fn(),
  bookingOperations: {
    getBookingById: vi.fn(),
    getUserBookings: vi.fn(),
    getCaregiverBookings: vi.fn(),
    updateBookingStatus: vi.fn(),
    createReview: vi.fn(),
  },
  paymentOperations: {
    getPaymentByIntentId: vi.fn(),
    updatePaymentStatus: vi.fn(),
    getPaymentsByBooking: vi.fn(),
  },
}));

// Mock database (used by stripe.ts)
vi.mock('@/lib/db', () => ({
  db: {
    platformSettings: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
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
    accounts: {
      retrieve: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
  }),
}));

// Mock logger to prevent console noise during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
    audit: vi.fn(),
    admin: vi.fn(),
  },
  getClientInfo: vi.fn().mockReturnValue({ ip: '127.0.0.1', userAgent: 'test' }),
}));
