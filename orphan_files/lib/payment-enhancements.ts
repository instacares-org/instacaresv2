// Payment Enhancement Utilities for InstaCares
import Stripe from 'stripe';
import { getStripeInstance } from '@/lib/stripe';
import { db } from '@/lib/db';
import type { Prisma, Payment, Booking } from '@prisma/client';

// Lazy Stripe accessor — resolved at call time so PM2 runtime secrets are available.
// Throws immediately if Stripe is not configured (catches misconfiguration early).
const getStripe = (): Stripe => {
  const instance = getStripeInstance();
  if (!instance) throw new Error('Stripe is not configured');
  return instance;
};
// Backwards-compatible alias — every `stripe.` call now goes through getStripe()
const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  }
});

// Add prisma alias for compatibility
const prisma = db;

// Mock audit logger for now
const paymentAuditLogger = {
  logPaymentEvent: (...args: unknown[]) => console.log('Payment audit:', ...args),
  logSecurityEvent: (...args: unknown[]) => console.log('Security audit:', ...args),
  logPaymentCreation: (...args: unknown[]) => console.log('Payment creation audit:', ...args),
  logRefund: (...args: unknown[]) => console.log('Refund audit:', ...args),
};

// Error type constants
const PaymentErrorType = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_NOT_ELIGIBLE: 'BOOKING_NOT_ELIGIBLE',
  CAREGIVER_NOT_FOUND: 'CAREGIVER_NOT_FOUND',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  REFUND_FAILED: 'REFUND_FAILED',
} as const;

const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

// Mock error classes for now
class PaymentError extends Error {
  constructor(type: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PaymentError';
    // Store type and details for potential use by callers
    Object.assign(this, { type, details });
  }
}

// Security context interface for tracking operations
interface SecurityContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

// Type for caregiver profile with user relation included
type CaregiverWithUser = Prisma.CaregiverGetPayload<{
  include: { user: true };
}>;

// Type for booking with caregiver relations
type BookingWithCaregiverRelations = Prisma.BookingGetPayload<{
  include: {
    caregiverUser: true;
    caregiverProfile: { include: { user: true } };
  };
}>;

// Type for payment with full relations for refund processing
type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        parent: { include: { profile: true } };
        caregiverUser: { include: { profile: true } };
        caregiverProfile: { include: { user: { include: { profile: true } } } };
      };
    };
  };
}>;

// Type for booking with relations for invoice generation
type BookingWithInvoiceRelations = Prisma.BookingGetPayload<{
  include: {
    parent: true;
    caregiverProfile: { include: { user: true } };
    payments: true;
  };
}>;

// Type for booking with relations for escrow release
type BookingWithEscrowRelations = Prisma.BookingGetPayload<{
  include: {
    payments: true;
    caregiverProfile: true;
  };
}>;

// ========== SPLIT PAYMENTS FOR SHARED CUSTODY ==========
export interface SplitPaymentParty {
  userId: string;
  email: string;
  name: string;
  percentage: number; // Percentage of total payment (0-100)
  amount?: number; // Calculated amount
}

export async function createSplitPayment(
  bookingId: string,
  totalAmount: number,
  parties: SplitPaymentParty[],
  caregiverId: string,
  platformFeePercentage: number = 15,
  context?: SecurityContext
) {
  return await db.$transaction(async (tx) => {
    try {
      // Validate percentages total 100%
      const totalPercentage = parties.reduce((sum, party) => sum + party.percentage, 0);
      if (totalPercentage !== 100) {
        throw new PaymentError(
          PaymentErrorType.VALIDATION_ERROR,
          'Split payment percentages must total 100%',
          {
            code: 400,
            severity: ErrorSeverity.LOW,
            details: { totalPercentage, expectedPercentage: 100 },
          }
        );
      }

      // Verify booking exists and is eligible for split payments
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          caregiverUser: true,
          caregiverProfile: { include: { user: true } },
        },
      });

      if (!booking) {
        throw new PaymentError(
          PaymentErrorType.BOOKING_NOT_FOUND,
          'Booking not found',
          { code: 404, severity: ErrorSeverity.MEDIUM }
        );
      }

      if (booking.status === 'CANCELLED' || booking.status === 'DISPUTED') {
        throw new PaymentError(
          PaymentErrorType.BOOKING_NOT_ELIGIBLE,
          'Booking is not eligible for split payments',
          { code: 400, severity: ErrorSeverity.MEDIUM }
        );
      }

      // Verify caregiver can receive payments via the caregiver profile
      const caregiverProfile = booking.caregiverProfile;
      if (!caregiverProfile?.stripeAccountId || !caregiverProfile?.canReceivePayments) {
        throw new PaymentError(
          PaymentErrorType.CAREGIVER_NOT_FOUND,
          'Caregiver is not set up to receive payments',
          { code: 400, severity: ErrorSeverity.MEDIUM }
        );
      }

      // Calculate amounts for each party
      const splitAmounts = parties.map(party => ({
        ...party,
        amount: Math.round((totalAmount * party.percentage) / 100)
      }));

      // Verify total amounts match (avoid rounding errors)
      const calculatedTotal = splitAmounts.reduce((sum, party) => sum + party.amount!, 0);
      if (Math.abs(calculatedTotal - totalAmount) > parties.length) {
        throw new PaymentError(
          PaymentErrorType.VALIDATION_ERROR,
          'Split payment amounts do not match total due to rounding',
          {
            code: 400,
            severity: ErrorSeverity.MEDIUM,
            details: { calculatedTotal, expectedTotal: totalAmount },
          }
        );
      }

      // Create payment intents for each party
      const paymentIntents: Stripe.PaymentIntent[] = [];
      const paymentRecords: Payment[] = [];

      for (const party of splitAmounts) {
        const platformFee = Math.round((party.amount! * platformFeePercentage) / 100);
        const caregiverAmount = party.amount! - platformFee;

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: party.amount!,
            currency: 'usd',
            customer: party.userId,
            description: `Split payment for booking ${bookingId} - ${party.name}`,
            metadata: {
              bookingId,
              userId: party.userId,
              splitPercentage: party.percentage.toString(),
              caregiverId,
              ...(context ? {
                securityContext: JSON.stringify({
                  initiatorId: context.userId,
                  ipAddress: context.ipAddress,
                }),
              } : {}),
            },
            transfer_data: {
              destination: caregiverProfile.stripeAccountId!,
              amount: caregiverAmount,
            },
            application_fee_amount: platformFee,
          });

          paymentIntents.push(paymentIntent);

          // Store split payment record in transaction
          // Payment model requires bookingId, amount, platformFee, caregiverPayout, stripePaymentIntentId
          const paymentRecord = await tx.payment.create({
            data: {
              bookingId,
              amount: party.amount!,
              platformFee,
              caregiverPayout: caregiverAmount,
              status: 'PENDING',
              stripePaymentIntentId: paymentIntent.id,
              paymentMethod: {
                type: 'SPLIT_PAYMENT',
                percentage: party.percentage,
                parentName: party.name,
                parentUserId: party.userId,
                platformFeePercentage,
                createdByUserId: context?.userId,
              } satisfies Record<string, unknown> as Prisma.InputJsonValue,
            },
          });

          paymentRecords.push(paymentRecord);

          // Log individual payment creation
          if (context) {
            await paymentAuditLogger.logPaymentCreation({
              paymentId: paymentRecord.id,
              userId: party.userId,
              bookingId,
              amount: party.amount!,
              currency: 'usd',
              paymentMethod: 'split_payment',
              stripePaymentIntentId: paymentIntent.id,
              metadata: {
                splitPercentage: party.percentage,
                parentName: party.name,
                initiatedBy: context.userId,
              },
            });
          }
        } catch (stripeError: unknown) {
          const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
          const errorType = stripeError instanceof Stripe.errors.StripeError ? stripeError.type : undefined;
          throw new PaymentError(
            PaymentErrorType.STRIPE_ERROR,
            `Failed to create payment intent for ${party.name}: ${errorMessage}`,
            {
              code: 502,
              severity: ErrorSeverity.HIGH,
              details: {
                stripeError: errorType,
                party: party.name,
                amount: party.amount,
              },
            }
          );
        }
      }

      // Update booking status or note via a status update
      // Booking model does not have a metadata field, so we track split payment via payment records
      // If we need to mark the booking, update its status or use a supported field
      // For now, the split payment info is stored in the payment records' paymentMethod JSON field

      return paymentIntents;
    } catch (error: unknown) {
      // Log the error for debugging
      if (context) {
        await paymentAuditLogger.logPaymentEvent({
          type: 'PAYMENT_ERROR',
          userId: context.userId,
          resourceId: bookingId,
          details: {
            operation: 'createSplitPayment',
            error: error instanceof Error ? error.message : 'Unknown error',
            totalAmount,
            partiesCount: parties.length,
          },
          severity: 'HIGH',
        });
      }
      throw error;
    }
  });
}


// ========== PAYMENT PLANS FOR REGULAR CLIENTS ==========
export interface PaymentPlanOptions {
  totalAmount: number;
  installments: number; // Number of installments
  frequency: 'weekly' | 'biweekly' | 'monthly';
  downPayment?: number; // Optional down payment
}

export async function createPaymentPlan(
  userId: string,
  caregiverId: string,
  options: PaymentPlanOptions,
  context?: SecurityContext
) {
  return await db.$transaction(async (tx) => {
    try {
      const { totalAmount, installments, frequency, downPayment = 0 } = options;

      // Validate payment plan parameters
      if (totalAmount < 5000) { // Minimum $50
        throw new PaymentError(
          PaymentErrorType.INVALID_AMOUNT,
          'Payment plan minimum amount is $50.00',
          { code: 400, severity: ErrorSeverity.LOW }
        );
      }

      if (downPayment > totalAmount) {
        throw new PaymentError(
          PaymentErrorType.INVALID_AMOUNT,
          'Down payment cannot exceed total amount',
          { code: 400, severity: ErrorSeverity.LOW }
        );
      }

      // Verify caregiver exists and can receive payments
      const caregiver = await tx.caregiver.findUnique({
        where: { id: caregiverId },
        include: { user: true },
      });

      if (!caregiver) {
        throw new PaymentError(
          PaymentErrorType.CAREGIVER_NOT_FOUND,
          'Caregiver not found',
          { code: 404, severity: ErrorSeverity.MEDIUM }
        );
      }

      if (!caregiver.stripeAccountId || !caregiver.canReceivePayments) {
        throw new PaymentError(
          PaymentErrorType.CAREGIVER_NOT_FOUND,
          'Caregiver is not set up to receive payments',
          { code: 400, severity: ErrorSeverity.MEDIUM }
        );
      }

      if (!caregiver.user.isActive) {
        throw new PaymentError(
          PaymentErrorType.CAREGIVER_NOT_FOUND,
          'Caregiver account is not active',
          { code: 400, severity: ErrorSeverity.MEDIUM }
        );
      }

      // Calculate installment amounts
      const remainingAmount = totalAmount - downPayment;
      const installmentAmount = Math.round(remainingAmount / installments);

      // Verify installment amount is reasonable
      if (installmentAmount < 1000) { // Minimum $10 per installment
        throw new PaymentError(
          PaymentErrorType.INVALID_AMOUNT,
          'Installment amount too small. Minimum $10.00 per installment.',
          {
            code: 400,
            severity: ErrorSeverity.LOW,
            details: { installmentAmount, minimumAmount: 1000 },
          }
        );
      }

      // Check for existing active payment plans
      // Payment model uses paymentMethod (Json?) to store plan type info
      const existingPlanPayments = await tx.payment.findMany({
        where: {
          bookingId: { not: undefined },
          status: 'PENDING',
        },
      });

      // Filter in application code since Prisma JSON filtering varies by provider
      const existingPlans = existingPlanPayments.filter(p => {
        const method = p.paymentMethod as Record<string, unknown> | null;
        return method?.type === 'PAYMENT_PLAN';
      });

      if (existingPlans.length >= 3) {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_ALREADY_PROCESSED,
          'Maximum number of active payment plans reached (3)',
          { code: 409, severity: ErrorSeverity.MEDIUM }
        );
      }

      // Create Stripe subscription for payment plan
      let product: Stripe.Product;
      let price: Stripe.Price;
      let subscription: Stripe.Subscription;

      try {
        product = await stripe.products.create({
          name: `Payment Plan - ${userId.substring(0, 8)}`,
          metadata: {
            userId,
            caregiverId,
            totalAmount: totalAmount.toString(),
            ...(context ? {
              securityContext: JSON.stringify({
                initiatorId: context.userId,
                ipAddress: context.ipAddress,
              }),
            } : {}),
          },
        });

        price = await stripe.prices.create({
          product: product.id,
          unit_amount: installmentAmount,
          currency: 'usd',
          recurring: {
            interval: frequency === 'weekly' ? 'week' : 'month',
            interval_count: frequency === 'biweekly' ? 2 : 1,
          },
        });

        subscription = await stripe.subscriptions.create({
          customer: userId,
          items: [{ price: price.id }],
          metadata: {
            userId,
            caregiverId,
            type: 'PAYMENT_PLAN',
            installments: installments.toString(),
            totalAmount: totalAmount.toString(),
            downPayment: downPayment.toString(),
          },
          collection_method: 'charge_automatically',
          billing_cycle_anchor: Math.floor(Date.now() / 1000) + (frequency === 'weekly' ? 604800 : 2592000),
        });
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
        const errorType = stripeError instanceof Stripe.errors.StripeError ? stripeError.type : undefined;
        throw new PaymentError(
          PaymentErrorType.STRIPE_ERROR,
          `Failed to create payment plan: ${errorMessage}`,
          {
            code: 502,
            severity: ErrorSeverity.HIGH,
            details: { stripeError: errorType },
          }
        );
      }

      // Store payment plan in database with transaction
      // Payment requires bookingId - we use a placeholder approach or the first relevant booking
      // For payment plans, we need a booking context. Use the subscription ID as the intent ID.
      // Note: The Payment model requires bookingId, platformFee, and caregiverPayout.
      // For a payment plan that spans multiple bookings, we create a tracking payment record.
      const paymentRecord = await tx.payment.create({
        data: {
          // Payment plans need a booking association - caller should provide one
          // For now we store plan metadata in paymentMethod JSON
          bookingId: '', // Caller should supply a valid bookingId for real usage
          amount: totalAmount,
          platformFee: 0,
          caregiverPayout: 0,
          status: 'PENDING',
          stripePaymentIntentId: subscription.id,
          paymentMethod: {
            type: 'PAYMENT_PLAN',
            installments,
            installmentAmount,
            frequency,
            downPayment,
            remainingAmount,
            stripeProductId: product.id,
            stripePriceId: price.id,
            stripeSubscriptionId: subscription.id,
            caregiverId,
            createdAt: new Date().toISOString(),
          } satisfies Record<string, unknown> as Prisma.InputJsonValue,
        },
      });

      // Log payment plan creation
      if (context) {
        await paymentAuditLogger.logPaymentCreation({
          paymentId: paymentRecord.id,
          userId,
          amount: totalAmount,
          currency: 'usd',
          paymentMethod: 'payment_plan',
          metadata: {
            installments,
            installmentAmount,
            frequency,
            downPayment,
            caregiverId,
            stripeSubscriptionId: subscription.id,
          },
        });
      }

      return { subscription, product, price, paymentRecord };
    } catch (error: unknown) {
      // Log the error for debugging
      if (context) {
        await paymentAuditLogger.logPaymentEvent({
          type: 'PAYMENT_ERROR',
          userId: context.userId,
          details: {
            operation: 'createPaymentPlan',
            error: error instanceof Error ? error.message : 'Unknown error',
            totalAmount: options.totalAmount,
            installments: options.installments,
            caregiverId,
          },
          severity: 'HIGH',
        });
      }
      throw error;
    }
  });
}

// ========== AUTOMATIC INVOICING WITH TAX RECEIPTS ==========
export async function generateAutomaticInvoice(
  bookingId: string,
  includesTaxReceipt: boolean = true
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      parent: true,
      caregiverProfile: { include: { user: true } },
      payments: true,
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Calculate tax information - use totalAmount from booking schema
  const taxRate = 0.0875; // 8.75% example tax rate
  const subtotal = booking.totalAmount;
  const taxAmount = includesTaxReceipt ? Math.round(subtotal * taxRate) : 0;
  const totalWithTax = subtotal + taxAmount;

  // Get caregiver name from the profile's user relation
  const caregiverName = booking.caregiverProfile.user.name ?? 'Caregiver';
  const parentName = booking.parent.name ?? 'Parent';

  // Find the first payment for this booking (if any)
  const payment = booking.payments.length > 0 ? booking.payments[0] : null;

  // Create invoice record
  // Invoice model requires: bookingId, invoiceNumber, type, recipientEmail, recipientName, amount, dueDate
  const invoiceNumber = `INV-${bookingId.substring(0, 8)}-${Date.now()}`;
  const invoice = await prisma.invoice.create({
    data: {
      bookingId,
      invoiceNumber,
      type: 'PARENT',
      recipientEmail: booking.parent.email,
      recipientName: parentName,
      amount: totalWithTax,
      status: 'DRAFT',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Generate PDF invoice using Stripe
  if (payment?.stripeChargeId) {
    const stripeInvoice = await stripe.invoices.create({
      customer: booking.parent.stripeCustomerId!,
      metadata: {
        bookingId,
        invoiceId: invoice.id,
      },
      custom_fields: [
        { name: 'Service Date', value: booking.startTime.toLocaleDateString() },
        { name: 'Caregiver', value: caregiverName },
        ...(includesTaxReceipt ? [{ name: 'Tax Receipt #', value: invoice.id }] : []),
      ],
    });

    // Add line items
    await stripe.invoiceItems.create({
      customer: booking.parent.stripeCustomerId!,
      invoice: stripeInvoice.id,
      amount: subtotal,
      description: `Childcare services - ${caregiverName}`,
    });

    if (taxAmount > 0) {
      await stripe.invoiceItems.create({
        customer: booking.parent.stripeCustomerId!,
        invoice: stripeInvoice.id,
        amount: taxAmount,
        description: 'Sales Tax',
      });
    }

    // Finalize and send invoice
    await stripe.invoices.finalizeInvoice(stripeInvoice.id!);
    await stripe.invoices.sendInvoice(stripeInvoice.id!);

    // Update invoice with Stripe details
    // Invoice model has pdfUrl (not receiptUrl) and invoiceNumber (not stripeInvoiceId)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'SENT',
        pdfUrl: stripeInvoice.hosted_invoice_url,
      },
    });
  }

  return invoice;
}

// ========== REFUND MANAGEMENT SYSTEM ==========
// Stripe-compatible refund reasons
type StripeRefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';

// Application-level refund reasons (superset of Stripe reasons)
type AppRefundReason = StripeRefundReason | 'service_not_provided';

export interface RefundOptions {
  reason: AppRefundReason;
  amount?: number; // Optional partial refund amount
  notify?: boolean; // Send notifications
}

export async function processRefund(
  paymentId: string,
  options: RefundOptions,
  context?: SecurityContext & { adminNote?: string }
) {
  return await db.$transaction(async (tx) => {
    try {
      // Fetch payment with all related data
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              parent: { include: { profile: true } },
              caregiverUser: { include: { profile: true } },
              caregiverProfile: { include: { user: { include: { profile: true } } } },
            },
          },
        },
      });

      if (!payment) {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_NOT_FOUND,
          'Payment not found',
          { code: 404, severity: ErrorSeverity.MEDIUM }
        );
      }

      if (payment.status !== 'PAID') {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_ALREADY_PROCESSED,
          'Only paid payments can be refunded',
          {
            code: 400,
            severity: ErrorSeverity.MEDIUM,
            details: { currentStatus: payment.status, requiredStatus: 'PAID' },
          }
        );
      }

      // Validate refund amount
      const refundAmount = options.amount || payment.amount;
      if (refundAmount > payment.amount) {
        throw new PaymentError(
          PaymentErrorType.INVALID_AMOUNT,
          'Refund amount cannot exceed original payment amount',
          {
            code: 400,
            severity: ErrorSeverity.MEDIUM,
            details: { refundAmount, originalAmount: payment.amount },
          }
        );
      }

      if (refundAmount <= 0) {
        throw new PaymentError(
          PaymentErrorType.INVALID_AMOUNT,
          'Refund amount must be positive',
          { code: 400, severity: ErrorSeverity.LOW }
        );
      }

      // Check refund time limit (e.g., 180 days for most transactions)
      const paymentAge = Date.now() - payment.createdAt.getTime();
      const maxRefundAge = 180 * 24 * 60 * 60 * 1000; // 180 days

      if (paymentAge > maxRefundAge && options.reason !== 'fraudulent') {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_ALREADY_PROCESSED,
          'Payment is too old to refund (max 180 days)',
          {
            code: 400,
            severity: ErrorSeverity.MEDIUM,
            details: { paymentAge: Math.floor(paymentAge / (24 * 60 * 60 * 1000)) },
          }
        );
      }

      // Create Stripe refund
      // Map application reason to Stripe-compatible reason
      const stripeReasonMap: Record<AppRefundReason, StripeRefundReason> = {
        requested_by_customer: 'requested_by_customer',
        duplicate: 'duplicate',
        fraudulent: 'fraudulent',
        service_not_provided: 'requested_by_customer', // Map to closest Stripe reason
      };
      const stripeReason: StripeRefundReason = stripeReasonMap[options.reason];

      let refund: Stripe.Refund;
      try {
        refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
          reason: stripeReason,
          metadata: {
            paymentId: payment.id,
            bookingId: payment.bookingId || '',
            processedBy: context?.userId || 'system',
            adminNote: context?.adminNote || '',
            ...(context ? {
              securityContext: JSON.stringify({
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
              }),
            } : {}),
          },
        });
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
        const stripeErrorObj = stripeError instanceof Stripe.errors.StripeError ? stripeError : null;
        throw new PaymentError(
          PaymentErrorType.REFUND_FAILED,
          `Stripe refund failed: ${errorMessage}`,
          {
            code: 502,
            severity: ErrorSeverity.HIGH,
            details: {
              stripeError: stripeErrorObj?.type,
              stripeCode: stripeErrorObj?.code,
              refundAmount,
            },
          }
        );
      }

      // Update payment status in transaction
      // Payment model does not have a metadata field; store refund info in paymentMethod JSON
      const existingPaymentMethod = (payment.paymentMethod as Record<string, unknown> | null) ?? {};
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          paymentMethod: {
            ...existingPaymentMethod,
            refund: {
              id: refund.id,
              amount: refund.amount,
              reason: options.reason,
              refundedAt: new Date().toISOString(),
              processedBy: context?.userId,
              adminNote: context?.adminNote,
              isPartialRefund: refundAmount < payment.amount,
              originalAmount: payment.amount,
            },
          } as Prisma.InputJsonValue,
        },
      });

      // Update booking status if full refund
      const isFullRefund = refundAmount === payment.amount;
      if (isFullRefund && payment.bookingId) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });
      }

      // Log refund processing
      if (context) {
        await paymentAuditLogger.logRefund({
          paymentId,
          refundId: refund.id,
          bookingId: payment.bookingId,
          amount: refund.amount,
          reason: options.reason,
          adminId: context.userId,
        });
      }

      // Send notifications if requested
      if (options.notify) {
        await sendRefundNotifications(payment, refund, {
          isPartialRefund: !isFullRefund,
          adminNote: context?.adminNote,
        });
      }

      return refund;
    } catch (error: unknown) {
      // Log the error for debugging
      if (context) {
        await paymentAuditLogger.logPaymentEvent({
          type: 'REFUND_FAILED',
          userId: context.userId,
          resourceId: paymentId,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            refundAmount: options.amount,
            reason: options.reason,
          },
          severity: 'HIGH',
        });
      }
      throw error;
    }
  });
}

// ========== MULTIPLE PAYMENT METHODS ==========
export async function addPaymentMethod(
  userId: string,
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay',
  token?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let paymentMethod: Stripe.PaymentMethod;

  switch (type) {
    case 'card':
      // Standard Stripe card payment method
      paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: token! },
      });
      break;

    case 'paypal':
      // PayPal integration
      paymentMethod = await stripe.paymentMethods.create({
        type: 'paypal' as Stripe.PaymentMethodCreateParams.Type,
        metadata: { userId },
      });
      break;

    case 'apple_pay':
    case 'google_pay':
      // Digital wallet integration - these use card type with token from the wallet
      paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: token! },
      });
      break;
  }

  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: user.stripeCustomerId!,
  });

  // Note: User model does not have a metadata field.
  // Payment method records are stored in Stripe and can be retrieved via the API.
  // If local storage is needed, consider a dedicated PaymentMethod model.
  // For now, we just return the Stripe payment method object.

  return paymentMethod;
}

// Helper function for sending refund notifications
async function sendRefundNotifications(
  payment: PaymentWithRelations | Payment,
  refund: Stripe.Refund,
  options: { isPartialRefund?: boolean; adminNote?: string } = {}
) {
  try {
    // Implementation would send emails/SMS to relevant parties
    console.log('Sending refund notifications...', {
      paymentId: payment.id,
      refundId: refund.id,
      amount: refund.amount,
      isPartialRefund: options.isPartialRefund,
      adminNote: options.adminNote,
    });

    // This would integrate with your notification system
    // await emailService.sendRefundConfirmation({
    //   to: payment.user.email,
    //   amount: refund.amount,
    //   refundId: refund.id,
    //   isPartialRefund: options.isPartialRefund,
    // });

    // await smsService.sendRefundAlert({
    //   to: payment.user.phone,
    //   amount: refund.amount,
    //   estimatedArrival: '5-7 business days',
    // });

  } catch (error: unknown) {
    console.error('Failed to send refund notifications:', error);
    // Don't throw - notification failures shouldn't break refund processing
  }
}

// ========== RECURRING PAYMENTS ==========
export async function setupRecurringPayment(
  userId: string,
  caregiverId: string,
  amount: number,
  frequency: 'weekly' | 'biweekly' | 'monthly'
) {
  // Create subscription product
  const product = await stripe.products.create({
    name: `Recurring childcare - ${caregiverId}`,
    metadata: { userId, caregiverId },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: 'usd',
    recurring: {
      interval: frequency === 'weekly' ? 'week' : 'month',
      interval_count: frequency === 'biweekly' ? 2 : 1,
    },
  });

  const subscription = await stripe.subscriptions.create({
    customer: userId,
    items: [{ price: price.id }],
    metadata: {
      userId,
      caregiverId,
      type: 'RECURRING_CHILDCARE',
    },
  });

  return { subscription, product, price };
}

// ========== ESCROW MANAGEMENT ==========
export async function releaseEscrowPayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true, caregiverProfile: true },
  });

  if (!booking || booking.payments.length === 0) {
    throw new Error('Booking or payment not found');
  }

  if (booking.status !== 'COMPLETED') {
    throw new Error('Booking must be completed to release escrow');
  }

  // Use the first payment for the booking
  const payment = booking.payments[0];

  // Transfer funds from platform to caregiver
  // Use caregiverPayout from the payment record
  const transfer = await stripe.transfers.create({
    amount: payment.caregiverPayout,
    currency: 'usd',
    destination: booking.caregiverProfile.stripeAccountId!,
    source_transaction: payment.stripeChargeId!,
    metadata: {
      bookingId,
      type: 'ESCROW_RELEASE',
    },
  });

  // Update payment status - store escrow info in paymentMethod JSON
  const existingPaymentMethod = (payment.paymentMethod as Record<string, unknown> | null) ?? {};
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentMethod: {
        ...existingPaymentMethod,
        escrowReleased: true,
        escrowReleasedAt: new Date().toISOString(),
        transferId: transfer.id,
      } as Prisma.InputJsonValue,
    },
  });

  return transfer;
}
