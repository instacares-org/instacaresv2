/**
 * Validation schemas for payment operations
 * Provides comprehensive input validation for all payment-related APIs
 */

import Joi from 'joi';

// Common validation rules
const commonRules = {
  uuid: Joi.string().uuid({ version: 'uuidv4' }).required(),
  positiveAmount: Joi.number().integer().min(50).max(10000000).required(), // Min $0.50, Max $100k
  percentage: Joi.number().min(0).max(100).required(),
  email: Joi.string().email().max(254).required(),
  name: Joi.string().min(1).max(100).trim().required(),
  optionalString: Joi.string().max(500).trim().allow('', null),
  userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  timestamp: Joi.date().iso().required(),
};

// Split Payment Validation
export const splitPaymentSchema = Joi.object({
  bookingId: commonRules.uuid.description('Booking ID'),
  totalAmount: commonRules.positiveAmount.description('Total payment amount in cents'),
  caregiverId: commonRules.uuid.description('Caregiver ID'),
  platformFeePercentage: Joi.number().min(0).max(50).default(15).description('Platform fee percentage'),
  parties: Joi.array()
    .items(
      Joi.object({
        userId: commonRules.userId.description('User ID for the party'),
        email: commonRules.email.description('Email address of the party'),
        name: commonRules.name.description('Name of the party'),
        percentage: commonRules.percentage.description('Payment percentage (must total 100%)'),
      }).required()
    )
    .min(2)
    .max(10)
    .required()
    .custom((parties, helpers) => {
      // Validate percentages total 100%
      const totalPercentage = parties.reduce((sum: number, party: any) => sum + party.percentage, 0);
      if (totalPercentage !== 100) {
        return helpers.error('custom.percentageTotal', { totalPercentage });
      }
      
      // Validate unique user IDs
      const userIds = parties.map((party: any) => party.userId);
      const uniqueUserIds = new Set(userIds);
      if (userIds.length !== uniqueUserIds.size) {
        return helpers.error('custom.duplicateUsers');
      }
      
      return parties;
    })
    .messages({
      'custom.percentageTotal': 'Split payment percentages must total 100%, got {{#totalPercentage}}%',
      'custom.duplicateUsers': 'Split payment parties must have unique user IDs',
    })
    .description('Array of payment parties'),
}).required();

// Tip Payment Validation
export const tipPaymentSchema = Joi.object({
  bookingId: commonRules.uuid.description('Booking ID'),
  tipAmount: Joi.number()
    .integer()
    .min(100) // Minimum $1.00 tip
    .max(50000) // Maximum $500 tip
    .required()
    .description('Tip amount in cents'),
}).required();

// Payment Plan Validation
export const paymentPlanSchema = Joi.object({
  caregiverId: commonRules.uuid.description('Caregiver ID'),
  totalAmount: Joi.number()
    .integer()
    .min(5000) // Minimum $50 for payment plans
    .max(5000000) // Maximum $50k for payment plans
    .required()
    .description('Total amount in cents'),
  installments: Joi.number()
    .integer()
    .min(2)
    .max(12)
    .required()
    .description('Number of installments'),
  frequency: Joi.string()
    .valid('weekly', 'biweekly', 'monthly')
    .required()
    .description('Payment frequency'),
  downPayment: Joi.number()
    .integer()
    .min(0)
    .max(Joi.ref('totalAmount'))
    .default(0)
    .description('Down payment amount in cents'),
}).required();

// Refund Validation
export const refundSchema = Joi.object({
  paymentId: commonRules.uuid.description('Payment ID to refund'),
  reason: Joi.string()
    .valid('requested_by_customer', 'duplicate', 'fraudulent', 'service_not_provided')
    .required()
    .description('Refund reason'),
  amount: Joi.number()
    .integer()
    .min(1)
    .max(10000000)
    .optional()
    .description('Partial refund amount in cents (omit for full refund)'),
  notify: Joi.boolean()
    .default(true)
    .description('Whether to send notifications'),
  adminNote: commonRules.optionalString.description('Admin note for the refund'),
}).required();

// Payment Method Validation
export const paymentMethodSchema = Joi.object({
  type: Joi.string()
    .valid('card', 'paypal', 'apple_pay', 'google_pay')
    .required()
    .description('Payment method type'),
  token: Joi.when('type', {
    is: 'card',
    then: Joi.string().required().description('Stripe token for card payments'),
    otherwise: Joi.string().optional().description('Optional token for other payment types'),
  }),
  makeDefault: Joi.boolean()
    .default(false)
    .description('Make this the default payment method'),
}).required();

// Recurring Payment Validation
export const recurringPaymentSchema = Joi.object({
  caregiverId: commonRules.uuid.description('Caregiver ID'),
  amount: commonRules.positiveAmount.description('Recurring amount in cents'),
  frequency: Joi.string()
    .valid('weekly', 'biweekly', 'monthly')
    .required()
    .description('Payment frequency'),
  startDate: Joi.date()
    .iso()
    .min('now')
    .required()
    .description('Start date for recurring payments'),
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .description('Optional end date for recurring payments'),
}).required();

// Invoice Generation Validation
export const invoiceSchema = Joi.object({
  bookingId: commonRules.uuid.description('Booking ID'),
  includesTaxReceipt: Joi.boolean()
    .default(true)
    .description('Include tax receipt information'),
  customLineItems: Joi.array()
    .items(
      Joi.object({
        description: Joi.string().min(1).max(100).required(),
        amount: Joi.number().integer().min(1).max(1000000).required(),
        quantity: Joi.number().integer().min(1).max(100).default(1),
      })
    )
    .max(10)
    .optional()
    .description('Optional custom line items'),
}).required();

// Escrow Release Validation
export const escrowReleaseSchema = Joi.object({
  bookingId: commonRules.uuid.description('Booking ID'),
  releaseAmount: Joi.number()
    .integer()
    .min(1)
    .max(10000000)
    .optional()
    .description('Partial release amount in cents (omit for full release)'),
  releaseReason: Joi.string()
    .valid('service_completed', 'partial_completion', 'admin_override')
    .default('service_completed')
    .description('Reason for escrow release'),
  adminNote: commonRules.optionalString.description('Admin note for the release'),
}).required();

// Webhook validation for Stripe events
export const webhookSchema = Joi.object({
  id: Joi.string().required().description('Stripe event ID'),
  object: Joi.string().valid('event').required(),
  type: Joi.string().required().description('Event type'),
  data: Joi.object().required().description('Event data'),
  created: Joi.number().integer().required().description('Event timestamp'),
  livemode: Joi.boolean().required().description('Live mode flag'),
  pending_webhooks: Joi.number().integer().required(),
  request: Joi.object({
    id: Joi.string().allow(null),
    idempotency_key: Joi.string().allow(null),
  }).allow(null),
}).required();

// Rate limiting validation (for request headers)
export const rateLimitSchema = Joi.object({
  'x-forwarded-for': Joi.string().optional(),
  'user-agent': Joi.string().max(500).optional(),
  'authorization': Joi.string().optional(),
}).unknown(true); // Allow other headers

// Query parameter validation for payment listings
export const paymentListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('PENDING', 'PAID', 'REFUNDED', 'FAILED').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  bookingId: commonRules.uuid.optional(),
  userId: commonRules.userId.optional(),
  sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).required();

// Export all schemas for easy import
export const paymentSchemas = {
  splitPayment: splitPaymentSchema,
  tipPayment: tipPaymentSchema,
  paymentPlan: paymentPlanSchema,
  refund: refundSchema,
  paymentMethod: paymentMethodSchema,
  recurringPayment: recurringPaymentSchema,
  invoice: invoiceSchema,
  escrowRelease: escrowReleaseSchema,
  webhook: webhookSchema,
  rateLimit: rateLimitSchema,
  paymentListQuery: paymentListQuerySchema,
};

// Validation helper function
export function validatePaymentInput<T>(
  schema: Joi.ObjectSchema,
  data: unknown,
  options: Joi.ValidationOptions = {}
): { value: T; error?: Joi.ValidationError } {
  const defaultOptions: Joi.ValidationOptions = {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    ...options,
  };

  const result = schema.validate(data, defaultOptions);
  
  return {
    value: result.value,
    error: result.error,
  };
}

// Custom validation for monetary amounts
export function validateMonetaryAmount(
  amount: number,
  minCents: number = 50,
  maxCents: number = 10000000
): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= minCents &&
    amount <= maxCents
  );
}

// Validation for user permissions based on payment type
export function validatePaymentPermissions(
  userRole: string,
  paymentType: string
): boolean {
  const rolePermissions = {
    ADMIN: ['ALL'],
    PARENT: ['TIP', 'SPLIT_PAYMENT', 'PAYMENT_PLAN', 'REFUND_REQUEST'],
    CAREGIVER: ['ESCROW_RELEASE', 'PAYMENT_METHOD'],
  };

  const userPermissions = rolePermissions[userRole as keyof typeof rolePermissions] || [];
  
  return userPermissions.includes('ALL') || userPermissions.includes(paymentType);
}