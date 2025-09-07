/**
 * Centralized error message handling with user-friendly messages
 */

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: any;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  code?: string;
}

/**
 * Map of technical errors to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  // Authentication & Authorization
  'AUTHENTICATION_REQUIRED': {
    title: 'Please Sign In',
    message: 'You need to sign in to access this feature.',
    action: 'Sign in to continue'
  },
  'INVALID_TOKEN': {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again.',
    action: 'Sign in again'
  },
  'ACCOUNT_NOT_APPROVED': {
    title: 'Account Pending Approval',
    message: 'Your account is still being reviewed. You\'ll receive an email once it\'s approved.',
    action: 'Wait for approval email'
  },
  'INSUFFICIENT_PERMISSIONS': {
    title: 'Access Denied',
    message: 'You don\'t have permission to perform this action.',
    action: 'Contact support if this seems wrong'
  },

  // User Input & Validation
  'MISSING_REQUIRED_FIELDS': {
    title: 'Missing Information',
    message: 'Please fill in all required fields before continuing.',
    action: 'Check all required fields'
  },
  'INVALID_EMAIL_FORMAT': {
    title: 'Invalid Email',
    message: 'Please enter a valid email address.',
    action: 'Check your email format'
  },
  'PASSWORD_TOO_WEAK': {
    title: 'Weak Password',
    message: 'Password must be at least 8 characters with letters, numbers, and symbols.',
    action: 'Create a stronger password'
  },
  'INVALID_DATE_RANGE': {
    title: 'Invalid Dates',
    message: 'The end time must be after the start time.',
    action: 'Check your selected times'
  },
  'BOOKING_TOO_SHORT': {
    title: 'Booking Too Short',
    message: 'Bookings must be at least 2 hours long.',
    action: 'Extend your booking time'
  },

  // Data & Resources
  'USER_NOT_FOUND': {
    title: 'Account Not Found',
    message: 'We couldn\'t find an account with that information.',
    action: 'Double-check your details'
  },
  'CAREGIVER_NOT_FOUND': {
    title: 'Caregiver Unavailable',
    message: 'This caregiver is no longer available for booking.',
    action: 'Try selecting another caregiver'
  },
  'BOOKING_NOT_FOUND': {
    title: 'Booking Not Found',
    message: 'We couldn\'t find the booking you\'re looking for.',
    action: 'Check your bookings list'
  },
  'DUPLICATE_EMAIL': {
    title: 'Email Already Used',
    message: 'An account with this email already exists.',
    action: 'Try signing in instead'
  },

  // Service & System
  'PAYMENT_FAILED': {
    title: 'Payment Failed',
    message: 'We couldn\'t process your payment. Please try again.',
    action: 'Check your payment details'
  },
  'EMAIL_SEND_FAILED': {
    title: 'Email Delivery Issue',
    message: 'We couldn\'t send the confirmation email, but your action was successful.',
    action: 'Check your spam folder'
  },
  'DATABASE_ERROR': {
    title: 'System Error',
    message: 'Something went wrong on our end. Please try again in a moment.',
    action: 'Try again in a few minutes'
  },
  'RATE_LIMIT_EXCEEDED': {
    title: 'Too Many Attempts',
    message: 'You\'ve made too many requests. Please wait before trying again.',
    action: 'Wait 5 minutes and try again'
  },

  // Booking-specific
  'CAREGIVER_UNAVAILABLE': {
    title: 'Caregiver Unavailable',
    message: 'This caregiver is not available for the selected time.',
    action: 'Choose a different time or caregiver'
  },
  'BOOKING_CONFLICT': {
    title: 'Time Conflict',
    message: 'You already have a booking during this time.',
    action: 'Check your existing bookings'
  },
  'PAST_DATE_BOOKING': {
    title: 'Invalid Date',
    message: 'You cannot create bookings for past dates.',
    action: 'Select a future date'
  },

  // Canadian-specific
  'POSTAL_CODE_INVALID': {
    title: 'Invalid Postal Code',
    message: 'Please enter a valid Canadian postal code (e.g., K1A 0A6).',
    action: 'Use format: A1A 1A1'
  },
  'PROVINCE_NOT_SUPPORTED': {
    title: 'Service Unavailable',
    message: 'InstaCares is not yet available in your province.',
    action: 'Check back soon for updates'
  }
};

/**
 * Convert technical error to user-friendly message
 */
export function getUserFriendlyError(
  error: string | ErrorResponse,
  defaultTitle: string = 'Something Went Wrong'
): UserFriendlyError {
  let errorCode: string;
  let originalMessage: string;

  if (typeof error === 'string') {
    errorCode = error.toUpperCase().replace(/\s+/g, '_');
    originalMessage = error;
  } else {
    errorCode = (error.code || error.error || '').toUpperCase().replace(/\s+/g, '_');
    originalMessage = error.message || error.error || '';
  }

  // Check if we have a predefined user-friendly message
  const userFriendlyError = ERROR_MESSAGES[errorCode];
  
  if (userFriendlyError) {
    return {
      ...userFriendlyError,
      code: errorCode
    };
  }

  // Generate a generic user-friendly message
  return {
    title: defaultTitle,
    message: generateGenericMessage(originalMessage),
    action: 'Please try again or contact support',
    code: errorCode
  };
}

/**
 * Generate a more user-friendly version of a technical message
 */
function generateGenericMessage(technicalMessage: string): string {
  const message = technicalMessage.toLowerCase();

  // Database/connection errors
  if (message.includes('connection') || message.includes('timeout')) {
    return 'We\'re having trouble connecting to our servers. Please try again in a moment.';
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return 'Some of the information you entered needs to be corrected.';
  }

  // Permission/auth errors
  if (message.includes('permission') || message.includes('unauthorized')) {
    return 'You don\'t have permission to perform this action.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return 'We\'re having network issues. Please check your connection and try again.';
  }

  // Generic fallback
  return 'We encountered an issue while processing your request. Please try again.';
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(
  error: string | Error,
  statusCode: number = 500,
  details?: any
): Response {
  let errorMessage: string;
  let userFriendlyError: UserFriendlyError;

  if (error instanceof Error) {
    errorMessage = error.message;
    userFriendlyError = getUserFriendlyError(error.message);
  } else {
    errorMessage = error;
    userFriendlyError = getUserFriendlyError(error);
  }

  const response: ErrorResponse = {
    error: userFriendlyError.title,
    message: userFriendlyError.message,
    code: userFriendlyError.code,
    ...(process.env.NODE_ENV === 'development' && { 
      details: {
        originalError: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        ...details
      }
    })
  };

  return Response.json(response, { status: statusCode });
}

/**
 * Error codes for common scenarios
 */
export const ErrorCodes = {
  // Auth
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_NOT_APPROVED: 'ACCOUNT_NOT_APPROVED',
  
  // Validation
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  
  // Resources
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CAREGIVER_NOT_FOUND: 'CAREGIVER_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  
  // System
  DATABASE_ERROR: 'DATABASE_ERROR',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];