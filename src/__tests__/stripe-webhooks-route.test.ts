import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted() so these variables are available inside vi.mock factories
const {
  mockConstructEvent,
  mockFindUserByEmail,
  mockCreateBooking,
  mockCreatePayment,
  mockUpdateBookingStatus,
  mockHeadersFn,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockFindUserByEmail: vi.fn(),
  mockCreateBooking: vi.fn(),
  mockCreatePayment: vi.fn(),
  mockUpdateBookingStatus: vi.fn(),
  mockHeadersFn: vi.fn(),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: mockHeadersFn,
}));

// Mock @/lib/stripe with a stripe object that has webhooks.constructEvent
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    paymentIntents: { retrieve: vi.fn() },
  },
  getStripeInstance: vi.fn().mockReturnValue({
    webhooks: { constructEvent: mockConstructEvent },
    paymentIntents: { retrieve: vi.fn() },
  }),
  getCommissionRate: vi.fn().mockResolvedValue(0.21),
}));

// Mock @/lib/db with the operations used by the webhook handler
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    booking: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
  userOperations: {
    findUserByEmail: mockFindUserByEmail,
  },
  bookingOperations: {
    createBooking: mockCreateBooking,
    updateBookingStatus: mockUpdateBookingStatus,
    getBookingById: vi.fn(),
    getUserBookings: vi.fn(),
    getCaregiverBookings: vi.fn(),
    createReview: vi.fn(),
  },
  paymentOperations: {
    createPayment: mockCreatePayment,
    getPaymentByIntentId: vi.fn(),
    updatePaymentStatus: vi.fn(),
    getPaymentsByBooking: vi.fn(),
  },
}));

import { POST } from '@/app/api/stripe/webhooks/route';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createWebhookRequest(body: string, signature = 'whsec_test_sig') {
  return new NextRequest('http://localhost:3005/api/stripe/webhooks', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
  });
}

function makePaymentIntentEvent(
  type: string,
  paymentIntent: Record<string, unknown>
) {
  return {
    id: 'evt_test_123',
    type,
    data: {
      object: paymentIntent,
    },
  };
}

const validPaymentIntent = {
  id: 'pi_test_success_1',
  amount: 10000, // $100.00
  application_fee_amount: 2100, // $21.00
  transfer_data: { destination: 'acct_caregiver_1' },
  metadata: {
    caregiverId: 'caregiver-1',
    parentEmail: 'parent@example.com',
    bookingDate: '2026-03-15',
    endDate: '2026-03-15',
    isMultiDay: 'false',
    startTime: '09:00',
    endTime: '13:00',
    childrenCount: '2',
    specialRequests: 'Allergic to peanuts',
    address: '123 Main St, Toronto',
  },
  last_payment_error: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: headers() returns a Headers-like object with stripe-signature
    mockHeadersFn.mockResolvedValue(
      new Headers({ 'stripe-signature': 'whsec_test_sig' }) as any
    );

    // Set the webhook secret env variable
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  // ── Signature verification ──────────────────────────────────────────────

  it('rejects requests with an invalid webhook signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = createWebhookRequest('{"id":"evt_bad"}');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid signature');
  });

  it('calls constructEvent with the raw body and signature', async () => {
    const rawBody = JSON.stringify({ id: 'evt_123' });
    mockConstructEvent.mockReturnValue(
      makePaymentIntentEvent('unknown_event', {})
    );

    const req = createWebhookRequest(rawBody, 'sig_abc');
    await POST(req);

    expect(mockConstructEvent).toHaveBeenCalledWith(
      rawBody,
      'whsec_test_sig', // comes from the mocked headers() call
      process.env.STRIPE_WEBHOOK_SECRET
    );
  });

  // ── payment_intent.succeeded ──────────────────────────────────────────

  it('handles payment_intent.succeeded and creates booking + payment', async () => {
    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      validPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    // Mock parent lookup
    mockFindUserByEmail.mockResolvedValue({
      id: 'parent-user-1',
      email: 'parent@example.com',
    });

    // Mock booking creation
    mockCreateBooking.mockResolvedValue({
      id: 'booking-1',
      parentId: 'parent-user-1',
      caregiverId: 'caregiver-1',
      status: 'PENDING',
    });

    // Mock payment creation
    mockCreatePayment.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      stripePaymentIntentId: 'pi_test_success_1',
      status: 'PAID',
    });

    // Mock booking status update
    mockUpdateBookingStatus.mockResolvedValue({
      id: 'booking-1',
      status: 'CONFIRMED',
    });

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);

    // Verify parent was looked up by email from metadata
    expect(mockFindUserByEmail).toHaveBeenCalledWith('parent@example.com');

    // Verify booking was created with correct parameters
    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 'parent-user-1',
        caregiverId: 'caregiver-1',
        childrenCount: 2,
        specialRequests: 'Allergic to peanuts',
        address: '123 Main St, Toronto',
        totalAmount: 10000,
        platformFee: 2100,
      })
    );

    // Verify payment record was created
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        stripePaymentIntentId: 'pi_test_success_1',
        amount: 10000,
        platformFee: 2100,
        caregiverPayout: 7900, // 10000 - 2100
        status: 'PAID',
      })
    );

    // Verify booking status was updated to CONFIRMED
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith(
      'booking-1',
      'CONFIRMED'
    );
  });

  it('updates booking status to CONFIRMED on successful payment', async () => {
    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      validPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    mockFindUserByEmail.mockResolvedValue({ id: 'parent-user-1' });
    mockCreateBooking.mockResolvedValue({ id: 'booking-1' });
    mockCreatePayment.mockResolvedValue({ id: 'payment-1' });
    mockUpdateBookingStatus.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith('booking-1', 'CONFIRMED');
  });

  it('handles multi-day booking metadata correctly', async () => {
    const multiDayPaymentIntent = {
      ...validPaymentIntent,
      id: 'pi_multi_day_1',
      metadata: {
        ...validPaymentIntent.metadata,
        endDate: '2026-03-17',
        isMultiDay: 'true',
      },
    };

    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      multiDayPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    mockFindUserByEmail.mockResolvedValue({ id: 'parent-user-1' });
    mockCreateBooking.mockResolvedValue({ id: 'booking-multi' });
    mockCreatePayment.mockResolvedValue({ id: 'payment-multi' });
    mockUpdateBookingStatus.mockResolvedValue({});

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Verify the start and end dates span multiple days
    const bookingCall = mockCreateBooking.mock.calls[0][0];
    const startTime = new Date(bookingCall.startTime);
    const endTime = new Date(bookingCall.endTime);
    expect(endTime.getTime()).toBeGreaterThan(startTime.getTime());
    // End date should be March 17
    expect(endTime.getDate()).toBe(17);
  });

  it('skips booking creation when parent email is not found', async () => {
    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      validPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    // Parent not found
    mockFindUserByEmail.mockResolvedValue(null);

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);

    // Should NOT have tried to create a booking
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it('skips booking creation when required metadata fields are missing', async () => {
    const incompletePaymentIntent = {
      ...validPaymentIntent,
      id: 'pi_incomplete_1',
      metadata: {
        // Missing caregiverId and parentEmail
        bookingDate: '2026-03-15',
        startTime: '09:00',
        endTime: '13:00',
        childrenCount: '2',
      },
    };

    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      incompletePaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it('handles duplicate webhook gracefully via Prisma P2002 error', async () => {
    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      validPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    mockFindUserByEmail.mockResolvedValue({ id: 'parent-user-1' });
    mockCreateBooking.mockResolvedValue({ id: 'booking-dup' });

    // Simulate Prisma unique constraint violation on payment creation
    const prismaError = new Error('Unique constraint failed on the fields: (`stripePaymentIntentId`)');
    (prismaError as any).code = 'P2002';
    mockCreatePayment.mockRejectedValue(prismaError);

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);

    // Should still return 200 (duplicate is handled gracefully)
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // ── payment_intent.payment_failed ─────────────────────────────────────

  it('handles payment_intent.payment_failed event', async () => {
    const failedPaymentIntent = {
      id: 'pi_failed_1',
      amount: 5000,
      last_payment_error: {
        message: 'Your card was declined.',
        code: 'card_declined',
      },
      metadata: {
        caregiverId: 'caregiver-1',
        parentEmail: 'parent@example.com',
      },
    };

    const event = makePaymentIntentEvent(
      'payment_intent.payment_failed',
      failedPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  // ── account.updated ───────────────────────────────────────────────────

  it('handles account.updated event', async () => {
    const accountEvent = {
      id: 'evt_account_1',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_test_123',
          charges_enabled: true,
          details_submitted: true,
          payouts_enabled: true,
        },
      },
    };
    mockConstructEvent.mockReturnValue(accountEvent);

    const req = createWebhookRequest(JSON.stringify(accountEvent));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // ── payout.paid ───────────────────────────────────────────────────────

  it('handles payout.paid event', async () => {
    const payoutEvent = {
      id: 'evt_payout_1',
      type: 'payout.paid',
      data: {
        object: {
          id: 'po_test_123',
          amount: 7900,
          destination: 'ba_test_456',
          arrival_date: 1700000000,
        },
      },
    };
    mockConstructEvent.mockReturnValue(payoutEvent);

    const req = createWebhookRequest(JSON.stringify(payoutEvent));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // ── payout.failed ─────────────────────────────────────────────────────

  it('handles payout.failed event', async () => {
    const payoutFailedEvent = {
      id: 'evt_payout_fail_1',
      type: 'payout.failed',
      data: {
        object: {
          id: 'po_failed_123',
          failure_code: 'account_closed',
          failure_message: 'The bank account has been closed',
        },
      },
    };
    mockConstructEvent.mockReturnValue(payoutFailedEvent);

    const req = createWebhookRequest(JSON.stringify(payoutFailedEvent));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // ── Unknown events ────────────────────────────────────────────────────

  it('handles unknown event types gracefully and returns 200', async () => {
    const unknownEvent = {
      id: 'evt_unknown_1',
      type: 'customer.subscription.created',
      data: {
        object: { id: 'sub_test_123' },
      },
    };
    mockConstructEvent.mockReturnValue(unknownEvent);

    const req = createWebhookRequest(JSON.stringify(unknownEvent));
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns 200 even when booking creation fails (error caught internally)', async () => {
    // handleSuccessfulPayment has its own try/catch that catches errors
    // internally and logs them, so the outer handler still returns 200.
    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      validPaymentIntent
    );
    mockConstructEvent.mockReturnValue(event);

    mockFindUserByEmail.mockResolvedValue({ id: 'parent-user-1' });
    mockCreateBooking.mockRejectedValue(new Error('Database connection failed'));

    const req = createWebhookRequest(JSON.stringify(event));
    const res = await POST(req);

    // Error is caught within handleSuccessfulPayment, webhook returns 200
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it('calculates caregiver payout as amount minus application fee', async () => {
    const paymentIntentWithFee = {
      ...validPaymentIntent,
      id: 'pi_fee_calc_1',
      amount: 20000, // $200
      application_fee_amount: 4200, // $42
    };

    const event = makePaymentIntentEvent(
      'payment_intent.succeeded',
      paymentIntentWithFee
    );
    mockConstructEvent.mockReturnValue(event);

    mockFindUserByEmail.mockResolvedValue({ id: 'parent-user-1' });
    mockCreateBooking.mockResolvedValue({ id: 'booking-fee' });
    mockCreatePayment.mockResolvedValue({ id: 'payment-fee' });
    mockUpdateBookingStatus.mockResolvedValue({});

    const req = createWebhookRequest(JSON.stringify(event));
    await POST(req);

    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        caregiverPayout: 15800, // 20000 - 4200
      })
    );
  });
});
