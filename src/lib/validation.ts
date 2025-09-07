import { z } from 'zod';

// Strong password validation schema with comprehensive security requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)')
  .refine((password) => {
    // Check against common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'login', 'pass', 'master', 'hello',
      'princess', 'dragon', 'shadow', 'joshua', 'michael'
    ];
    return !commonPasswords.includes(password.toLowerCase());
  }, 'Password is too common and easily guessable')
  .refine((password) => {
    // Check for keyboard patterns
    const patterns = ['123456', 'qwerty', 'asdfgh', 'zxcvbn'];
    return !patterns.some(pattern => password.toLowerCase().includes(pattern));
  }, 'Password contains common keyboard patterns')
  .refine((password) => {
    // Check for repeated characters (more than 3 consecutive)
    return !/(.)\1{3,}/.test(password);
  }, 'Password contains too many repeated characters');

// Phone number validation (flexible format)
export const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must not exceed 15 digits')
  .regex(/^[\d\s\-\(\)\+\.]+$/, 'Please enter a valid phone number');

// Email validation with additional checks
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .trim();

// Name validation (simplified and more permissive)
export const nameSchema = z
  .string()
  .min(1, 'This field is required')
  .max(50, 'Name must not exceed 50 characters')
  .refine(val => val.length > 0 && !/<|>|&|script/i.test(val), 'Name contains invalid characters')
  .trim();

// User registration schema
export const registrationSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  phone: phoneSchema,
  userType: z.enum(['parent', 'provider'], { message: 'Please select a valid user type' }),
  agreeToTerms: z.union([z.boolean(), z.string()]).refine(
    val => val === true || val === 'true' || val === 'on', 
    { message: 'You must agree to the terms and conditions' }
  ),
  agreeToMarketing: z.union([z.boolean(), z.string()]).optional(),
  // Address fields (optional during signup)
  streetAddress: z.string().max(200, 'Street address must not exceed 200 characters').optional(),
  apartment: z.string().max(50, 'Apartment/unit must not exceed 50 characters').optional(),
  city: z.string().max(100, 'City must not exceed 100 characters').optional(),
  province: z.string().max(50, 'Province must not exceed 50 characters').optional(),
  postalCode: z.string().max(20, 'Postal code must not exceed 20 characters').optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Admin approval schema
export const approvalSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED'], { message: 'Invalid approval action' }),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional()
});

// Sanitize HTML input to prevent XSS
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Normalize phone number for storage
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, ''); // Remove all non-digits
}

// Rate limiting helper
export interface RateLimitResult {
  success: boolean;
  error?: string;
  remaining?: number;
  resetTime?: number;
}

// Simple in-memory rate limiter (should use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxAttempts: number = 5, 
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  
  const current = rateLimitMap.get(key);
  
  // Clean up expired entries
  if (current && now > current.resetTime) {
    rateLimitMap.delete(key);
  }
  
  const limit = rateLimitMap.get(key);
  
  if (!limit) {
    // First request
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
  }
  
  if (limit.count >= maxAttempts) {
    return { 
      success: false, 
      error: `Too many attempts. Try again in ${Math.ceil((limit.resetTime - now) / 60000)} minutes.`,
      remaining: 0,
      resetTime: limit.resetTime
    };
  }
  
  // Increment counter
  limit.count++;
  rateLimitMap.set(key, limit);
  
  return { 
    success: true, 
    remaining: maxAttempts - limit.count,
    resetTime: limit.resetTime
  };
}