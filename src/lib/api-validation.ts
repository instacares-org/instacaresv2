import { z } from 'zod';

/**
 * API Input Validation Schemas
 *
 * This file contains Zod validation schemas for critical API routes.
 * Using strict validation prevents:
 * - SQL injection attacks
 * - XSS attacks
 * - Buffer overflow attacks
 * - Invalid data causing crashes
 * - Malicious input exploitation
 */

// ============================================================================
// PAYMENT VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation for /api/stripe/payments/create-booking
 * Validates payment creation requests for booking
 */
export const CreateBookingPaymentSchema = z.object({
  caregiverStripeAccountId: z.string()
    .min(1, 'Caregiver Stripe account ID is required')
    .max(100, 'Invalid Stripe account ID')
    .regex(/^acct_[a-zA-Z0-9_]+$|^acct_demo_[a-zA-Z0-9_]+$|^acct_test_demo$/, 'Invalid Stripe account ID format'),

  amount: z.number()
    .int('Amount must be a whole number')
    .min(500, 'Amount must be at least $5.00') // $5 minimum in cents
    .max(100000000, 'Amount exceeds maximum limit'), // $1M maximum

  parentEmail: z.string()
    .email('Invalid email address')
    .min(5, 'Email too short')
    .max(254, 'Email too long')
    .toLowerCase()
    .trim(),

  caregiverName: z.string()
    .min(1, 'Caregiver name is required')
    .max(200, 'Caregiver name too long')
    .trim(),

  caregiverId: z.string()
    .min(10, 'Invalid caregiver ID')
    .max(50, 'Invalid caregiver ID')
    .optional(),

  bookingDetails: z.object({
    date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),

    startDate: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
      .optional(),

    endDate: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional(),

    isMultiDay: z.boolean().optional(),

    startTime: z.string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),

    endTime: z.string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),

    childrenCount: z.number()
      .int('Children count must be a whole number')
      .min(1, 'At least 1 child required')
      .max(10, 'Maximum 10 children allowed'),

    specialRequests: z.string()
      .max(1000, 'Special requests too long')
      .trim()
      .optional(),

    address: z.string()
      .max(500, 'Address too long')
      .trim()
      .optional(),

    latitude: z.number()
      .min(-90, 'Invalid latitude')
      .max(90, 'Invalid latitude')
      .optional(),

    longitude: z.number()
      .min(-180, 'Invalid longitude')
      .max(180, 'Invalid longitude')
      .optional(),
  })
});

/**
 * Validation for /api/stripe/payments/confirm
 * Validates payment confirmation requests
 */
export const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string()
    .min(1, 'Payment Intent ID is required')
    .max(100, 'Invalid Payment Intent ID')
    .regex(/^pi_[a-zA-Z0-9_]+$|^pi_demo_[a-zA-Z0-9_]+$/, 'Invalid Payment Intent ID format')
});

// ============================================================================
// BOOKING VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation for /api/bookings (POST)
 * Validates booking creation requests
 */
export const CreateBookingSchema = z.object({
  parentId: z.string()
    .min(10, 'Invalid parent ID')
    .max(50, 'Invalid parent ID'),

  caregiverId: z.string()
    .min(10, 'Invalid caregiver ID')
    .max(50, 'Invalid caregiver ID'),

  startTime: z.string()
    .min(1, 'Start time is required')
    .max(50, 'Invalid start time'),

  endTime: z.string()
    .min(1, 'End time is required')
    .max(50, 'Invalid end time'),

  childrenCount: z.number()
    .int('Children count must be a whole number')
    .min(1, 'At least 1 child required')
    .max(10, 'Maximum 10 children allowed'),

  specialRequests: z.string()
    .max(2000, 'Special requests too long')
    .trim()
    .optional(),

  address: z.string()
    .min(1, 'Address is required')
    .max(500, 'Address too long')
    .trim(),

  latitude: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude')
    .optional(),

  longitude: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude')
    .optional(),
});

// ============================================================================
// PROFILE VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation for /api/profile/update-address
 * Validates address update requests
 */
export const UpdateAddressSchema = z.object({
  streetAddress: z.string()
    .max(300, 'Street address too long')
    .trim()
    .optional()
    .or(z.literal('')),

  apartment: z.string()
    .max(100, 'Apartment/unit too long')
    .trim()
    .optional()
    .or(z.literal('')),

  city: z.string()
    .max(100, 'City too long')
    .trim()
    .optional()
    .or(z.literal('')),

  state: z.string()
    .max(100, 'State/province too long')
    .trim()
    .optional()
    .or(z.literal('')),

  zipCode: z.string()
    .max(20, 'Postal code too long')
    .trim()
    .optional()
    .or(z.literal('')),

  country: z.string()
    .max(100, 'Country too long')
    .trim()
    .optional()
    .or(z.literal('')),

  phone: z.string()
    .max(30, 'Phone number too long')
    .trim()
    .optional()
    .or(z.literal('')),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse and validate request body
 * Returns validation result with helpful error messages
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.safeParse(data);

    if (!result.success) {
      // Safely handle error mapping with fallback
      const zodErrors = result.error?.issues || [];
      const errors = Array.isArray(zodErrors)
        ? zodErrors.map(err => {
            const path = err.path?.join('.') || '';
            return `${path ? path + ': ' : ''}${err.message || 'Invalid value'}`;
          })
        : ['Validation failed'];

      return { success: false, errors };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('Validation error:', error);
    return { success: false, errors: ['Validation processing failed'] };
  }
}

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and JavaScript
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}
