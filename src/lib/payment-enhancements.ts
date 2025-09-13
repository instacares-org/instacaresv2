// Payment Enhancement Utilities for InstaCares
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Add prisma alias for compatibility
const prisma = db;

// Mock audit logger for now
const paymentAuditLogger = {
  logPaymentEvent: (...args: any[]) => console.log('Payment audit:', ...args),
  logSecurityEvent: (...args: any[]) => console.log('Security audit:', ...args)
};

// Mock error classes for now
class PaymentError extends Error {
  constructor(type: string, message: string, details?: any) {
    super(message);
    this.name = 'PaymentError';
  }
}

const PaymentErrorType = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

// Security context interface for tracking operations
interface SecurityContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

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
          caregiver: true,
          caregiverData: { include: { user: true } },
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

      // Verify caregiver can receive payments
      const caregiver = booking.caregiverData || booking.caregiver;
      if (!caregiver?.stripeAccountId || !caregiver?.canReceivePayments) {
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
      const paymentIntents = [];
      const paymentRecords = [];

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
              securityContext: context ? JSON.stringify({
                initiatorId: context.userId,
                ipAddress: context.ipAddress,
              }) : undefined,
            },
            transfer_data: {
              destination: caregiver.stripeAccountId!,
              amount: caregiverAmount,
            },
            application_fee_amount: platformFee,
          });

          paymentIntents.push(paymentIntent);

          // Store split payment record in transaction
          const paymentRecord = await tx.payment.create({
            data: {
              bookingId,
              userId: party.userId,
              amount: party.amount!,
              status: 'PENDING',
              stripePaymentIntentId: paymentIntent.id,
              metadata: {
                type: 'SPLIT_PAYMENT',
                percentage: party.percentage,
                parentName: party.name,
                platformFee,
                caregiverAmount,
                platformFeePercentage,
                createdByUserId: context?.userId,
                securityContext: context,
              },
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
        } catch (stripeError: any) {
          throw new PaymentError(
            PaymentErrorType.STRIPE_ERROR,
            `Failed to create payment intent for ${party.name}: ${stripeError.message}`,
            {
              code: 502,
              severity: ErrorSeverity.HIGH,
              details: {
                stripeError: stripeError.type,
                party: party.name,
                amount: party.amount,
              },
            }
          );
        }
      }

      // Update booking metadata with split payment info
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          metadata: {
            ...booking.metadata as any,
            splitPayment: {
              enabled: true,
              totalAmount,
              partiesCount: parties.length,
              platformFeePercentage,
              paymentIntentIds: paymentIntents.map(pi => pi.id),
              createdAt: new Date().toISOString(),
              createdBy: context?.userId,
            },
          },
        },
      });

      return paymentIntents;
    } catch (error) {
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
      const existingPlans = await tx.payment.count({
        where: {
          userId,
          status: { in: ['PENDING', 'ACTIVE'] },
          metadata: {
            path: '$.type',
            equals: 'PAYMENT_PLAN',
          },
        },
      });

      if (existingPlans >= 3) {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_ALREADY_PROCESSED,
          'Maximum number of active payment plans reached (3)',
          { code: 409, severity: ErrorSeverity.MEDIUM }
        );
      }

      // Create Stripe subscription for payment plan
      let product, price, subscription;
      
      try {
        product = await stripe.products.create({
          name: `Payment Plan - ${userId.substring(0, 8)}`,
          metadata: {
            userId,
            caregiverId,
            totalAmount: totalAmount.toString(),
            securityContext: context ? JSON.stringify({
              initiatorId: context.userId,
              ipAddress: context.ipAddress,
            }) : undefined,
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
      } catch (stripeError: any) {
        throw new PaymentError(
          PaymentErrorType.STRIPE_ERROR,
          `Failed to create payment plan: ${stripeError.message}`,
          {
            code: 502,
            severity: ErrorSeverity.HIGH,
            details: { stripeError: stripeError.type },
          }
        );
      }

      // Store payment plan in database with transaction
      const paymentRecord = await tx.payment.create({
        data: {
          userId,
          amount: totalAmount,
          status: 'PENDING',
          stripePaymentIntentId: subscription.id,
          metadata: {
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
            securityContext: context,
            createdAt: new Date().toISOString(),
          },
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
    } catch (error) {
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
      caregiver: true,
      payment: true,
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Calculate tax information
  const taxRate = 0.0875; // 8.75% example tax rate
  const subtotal = booking.totalPrice;
  const taxAmount = includesTaxReceipt ? Math.round(subtotal * taxRate) : 0;
  const totalAmount = subtotal + taxAmount;

  // Create invoice record
  const invoice = await prisma.invoice.create({
    data: {
      bookingId,
      userId: booking.parentId,
      type: 'PARENT',
      amount: totalAmount,
      status: 'DRAFT',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        subtotal,
        taxAmount,
        taxRate,
        includesTaxReceipt,
        serviceDate: booking.startTime.toISOString(),
        serviceDuration: booking.endTime.getTime() - booking.startTime.getTime(),
        caregiverName: booking.caregiver.name,
        parentName: booking.parent.name,
      },
    },
  });

  // Generate PDF invoice using Stripe
  if (booking.payment?.stripeChargeId) {
    const stripeInvoice = await stripe.invoices.create({
      customer: booking.parent.stripeCustomerId!,
      metadata: {
        bookingId,
        invoiceId: invoice.id,
      },
      custom_fields: [
        { name: 'Service Date', value: booking.startTime.toLocaleDateString() },
        { name: 'Caregiver', value: booking.caregiver.name },
        ...(includesTaxReceipt ? [{ name: 'Tax Receipt #', value: invoice.id }] : []),
      ],
    });

    // Add line items
    await stripe.invoiceItems.create({
      customer: booking.parent.stripeCustomerId!,
      invoice: stripeInvoice.id,
      amount: subtotal,
      description: `Childcare services - ${booking.caregiver.name}`,
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
    await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    await stripe.invoices.sendInvoice(stripeInvoice.id);

    // Update invoice with Stripe details
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripeInvoiceId: stripeInvoice.id,
        status: 'SENT',
        receiptUrl: stripeInvoice.hosted_invoice_url,
      },
    });
  }

  return invoice;
}

// ========== REFUND MANAGEMENT SYSTEM ==========
export interface RefundOptions {
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'service_not_provided';
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
          user: { include: { profile: true } },
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

      // Check if already refunded
      if (payment.status === 'REFUNDED') {
        throw new PaymentError(
          PaymentErrorType.PAYMENT_ALREADY_PROCESSED,
          'Payment has already been refunded',
          { code: 409, severity: ErrorSeverity.LOW }
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
      let refund;
      try {
        refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId!,
          amount: refundAmount,
          reason: options.reason,
          metadata: {
            paymentId: payment.id,
            bookingId: payment.bookingId || '',
            processedBy: context?.userId || 'system',
            adminNote: context?.adminNote || '',
            securityContext: context ? JSON.stringify({
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            }) : undefined,
          },
        });
      } catch (stripeError: any) {
        throw new PaymentError(
          PaymentErrorType.REFUND_FAILED,
          `Stripe refund failed: ${stripeError.message}`,
          {
            code: 502,
            severity: ErrorSeverity.HIGH,
            details: {
              stripeError: stripeError.type,
              stripeCode: stripeError.code,
              refundAmount,
            },
          }
        );
      }

      // Update payment status in transaction
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          metadata: {
            ...payment.metadata as any,
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
            securityContext: context,
          },
        },
      });

      // Update booking status if full refund
      const isFullRefund = refundAmount === payment.amount;
      if (isFullRefund && payment.bookingId) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...payment.booking?.metadata as any,
              cancellation: {
                cancelledAt: new Date().toISOString(),
                cancellationReason: options.reason,
                refundId: refund.id,
                refundAmount: refund.amount,
                processedBy: context?.userId,
              },
            },
          },
        });
      }

      // Log refund processing
      if (context) {
        await paymentAuditLogger.logRefund({
          paymentId,
          refundId: refund.id,
          userId: payment.userId,
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
    } catch (error) {
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

  let paymentMethod;

  switch (type) {
    case 'card':
      // Standard Stripe card payment method
      paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token },
      });
      break;

    case 'paypal':
      // PayPal integration
      paymentMethod = await stripe.paymentMethods.create({
        type: 'paypal',
        metadata: { userId },
      });
      break;

    case 'apple_pay':
    case 'google_pay':
      // Digital wallet integration
      paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { wallet: { type: type === 'apple_pay' ? 'apple_pay' : 'google_pay' } },
      });
      break;
  }

  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: user.stripeCustomerId!,
  });

  // Store payment method in database
  await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: {
        ...user.metadata as any,
        paymentMethods: [
          ...(user.metadata as any)?.paymentMethods || [],
          {
            id: paymentMethod.id,
            type,
            last4: paymentMethod.card?.last4,
            brand: paymentMethod.card?.brand,
            addedAt: new Date().toISOString(),
          },
        ],
      },
    },
  });

  return paymentMethod;
}

// Helper function for sending refund notifications
async function sendRefundNotifications(
  payment: any, 
  refund: any, 
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
    
  } catch (error) {
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
    include: { payment: true, caregiver: true },
  });

  if (!booking || !booking.payment) {
    throw new Error('Booking or payment not found');
  }

  if (booking.status !== 'COMPLETED') {
    throw new Error('Booking must be completed to release escrow');
  }

  // Transfer funds from platform to caregiver
  const transfer = await stripe.transfers.create({
    amount: booking.caregiverPayout,
    currency: 'usd',
    destination: booking.caregiver.stripeAccountId!,
    source_transaction: booking.payment.stripeChargeId!,
    metadata: {
      bookingId,
      type: 'ESCROW_RELEASE',
    },
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: booking.payment.id },
    data: {
      metadata: {
        ...booking.payment.metadata as any,
        escrowReleased: true,
        escrowReleasedAt: new Date().toISOString(),
        transferId: transfer.id,
      },
    },
  });

  return transfer;
}