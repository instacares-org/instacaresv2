/**
 * Secure error handling utilities for payment operations
 * Provides consistent error responses while protecting sensitive information
 */

import { NextResponse } from 'next/server';
import { PaymentAuditLogger } from '@/lib/audit/payment-audit';

// Error types for payment operations
export enum PaymentErrorType {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Resource errors
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  CAREGIVER_NOT_FOUND = 'CAREGIVER_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  
  // Business logic errors
  BOOKING_NOT_ELIGIBLE = 'BOOKING_NOT_ELIGIBLE',
  PAYMENT_ALREADY_PROCESSED = 'PAYMENT_ALREADY_PROCESSED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ESCROW_NOT_READY = 'ESCROW_NOT_READY',
  
  // Stripe/Payment provider errors
  STRIPE_ERROR = 'STRIPE_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  CARD_DECLINED = 'CARD_DECLINED',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  
  // Security errors
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  IP_BLOCKED = 'IP_BLOCKED',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Custom payment error class
export class PaymentError extends Error {
  public readonly type: PaymentErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code: number;
  public readonly details: Record<string, any>;
  public readonly userMessage: string;
  public readonly shouldLog: boolean;
  public readonly shouldNotify: boolean;

  constructor(
    type: PaymentErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity;
      code?: number;
      details?: Record<string, any>;
      userMessage?: string;
      shouldLog?: boolean;
      shouldNotify?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'PaymentError';
    this.type = type;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.code = options.code || 500;
    this.details = options.details || {};
    this.userMessage = options.userMessage || this.getDefaultUserMessage(type);
    this.shouldLog = options.shouldLog !== false; // Default to true
    this.shouldNotify = options.shouldNotify || this.severity === ErrorSeverity.CRITICAL;
  }

  private getDefaultUserMessage(type: PaymentErrorType): string {
    const userMessages: Record<PaymentErrorType, string> = {
      [PaymentErrorType.VALIDATION_ERROR]: 'Please check your input and try again.',
      [PaymentErrorType.INVALID_AMOUNT]: 'The payment amount is invalid.',
      [PaymentErrorType.INVALID_CURRENCY]: 'The currency is not supported.',
      [PaymentErrorType.UNAUTHORIZED]: 'Please log in to continue.',
      [PaymentErrorType.FORBIDDEN]: 'You do not have permission to perform this action.',
      [PaymentErrorType.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action.',
      [PaymentErrorType.BOOKING_NOT_FOUND]: 'The booking could not be found.',
      [PaymentErrorType.PAYMENT_NOT_FOUND]: 'The payment could not be found.',
      [PaymentErrorType.CAREGIVER_NOT_FOUND]: 'The caregiver could not be found.',
      [PaymentErrorType.USER_NOT_FOUND]: 'The user could not be found.',
      [PaymentErrorType.BOOKING_NOT_ELIGIBLE]: 'This booking is not eligible for this operation.',
      [PaymentErrorType.PAYMENT_ALREADY_PROCESSED]: 'This payment has already been processed.',
      [PaymentErrorType.INSUFFICIENT_BALANCE]: 'Insufficient balance for this transaction.',
      [PaymentErrorType.ESCROW_NOT_READY]: 'The escrow is not ready for release.',
      [PaymentErrorType.STRIPE_ERROR]: 'Payment processing error. Please try again.',
      [PaymentErrorType.PAYMENT_FAILED]: 'Payment failed. Please try again.',
      [PaymentErrorType.REFUND_FAILED]: 'Refund processing failed. Please contact support.',
      [PaymentErrorType.CARD_DECLINED]: 'Your card was declined. Please try a different payment method.',
      [PaymentErrorType.DATABASE_ERROR]: 'A system error occurred. Please try again later.',
      [PaymentErrorType.EXTERNAL_SERVICE_ERROR]: 'External service unavailable. Please try again later.',
      [PaymentErrorType.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again.',
      [PaymentErrorType.TRANSACTION_FAILED]: 'Transaction failed. Please try again.',
      [PaymentErrorType.SUSPICIOUS_ACTIVITY]: 'Suspicious activity detected. Please contact support.',
      [PaymentErrorType.IP_BLOCKED]: 'Access denied from your location.',
      [PaymentErrorType.FRAUD_DETECTED]: 'Transaction blocked for security reasons.',
    };

    return userMessages[type] || 'An error occurred. Please try again.';
  }
}

/**
 * Secure error handler for payment operations
 */
export class PaymentErrorHandler {
  private auditLogger: PaymentAuditLogger;
  private isDevelopment: boolean;

  constructor() {
    this.auditLogger = new PaymentAuditLogger();
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Handle and format errors for API responses
   */
  async handleError(
    error: unknown,
    context: {
      userId?: string;
      operation?: string;
      resourceId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<NextResponse> {
    let paymentError: PaymentError;

    // Convert unknown errors to PaymentError
    if (error instanceof PaymentError) {
      paymentError = error;
    } else if (error instanceof Error) {
      paymentError = this.convertToPaymentError(error);
    } else {
      paymentError = new PaymentError(
        PaymentErrorType.EXTERNAL_SERVICE_ERROR,
        'An unexpected error occurred',
        { severity: ErrorSeverity.HIGH }
      );
    }

    // Log the error if required
    if (paymentError.shouldLog) {
      await this.logError(paymentError, context);
    }

    // Send notifications for critical errors
    if (paymentError.shouldNotify) {
      await this.notifyError(paymentError, context);
    }

    // Create secure response
    return this.createErrorResponse(paymentError, context);
  }

  /**
   * Convert generic errors to PaymentError
   */
  private convertToPaymentError(error: Error): PaymentError {
    // Handle Stripe errors
    if (error.message.includes('stripe') || error.message.includes('card_declined')) {
      if (error.message.includes('card_declined')) {
        return new PaymentError(
          PaymentErrorType.CARD_DECLINED,
          error.message,
          { code: 402, severity: ErrorSeverity.LOW }
        );
      }
      return new PaymentError(
        PaymentErrorType.STRIPE_ERROR,
        error.message,
        { code: 502, severity: ErrorSeverity.MEDIUM }
      );
    }

    // Handle database errors
    if (error.message.includes('prisma') || error.message.includes('database')) {
      return new PaymentError(
        PaymentErrorType.DATABASE_ERROR,
        error.message,
        { code: 503, severity: ErrorSeverity.HIGH }
      );
    }

    // Handle validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        error.message,
        { code: 400, severity: ErrorSeverity.LOW }
      );
    }

    // Handle authorization errors
    if (error.message.includes('unauthorized') || error.message.includes('access denied')) {
      return new PaymentError(
        PaymentErrorType.FORBIDDEN,
        error.message,
        { code: 403, severity: ErrorSeverity.MEDIUM }
      );
    }

    // Default to external service error
    return new PaymentError(
      PaymentErrorType.EXTERNAL_SERVICE_ERROR,
      error.message,
      { severity: ErrorSeverity.MEDIUM }
    );
  }

  /**
   * Log error details securely
   */
  private async logError(
    error: PaymentError,
    context: {
      userId?: string;
      operation?: string;
      resourceId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await this.auditLogger.logSecurityEvent({
        type: 'PAYMENT_ERROR',
        userId: context.userId,
        resourceId: context.resourceId,
        details: {
          errorType: error.type,
          errorMessage: error.message,
          operation: context.operation,
          severity: error.severity,
          code: error.code,
          stackTrace: this.isDevelopment ? error.stack : undefined,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          ...error.details,
        },
        severity: error.severity,
      });
    } catch (loggingError) {
      // If logging fails, log to console as fallback
      console.error('Failed to log payment error:', loggingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Send notifications for critical errors
   */
  private async notifyError(
    error: PaymentError,
    context: {
      userId?: string;
      operation?: string;
      resourceId?: string;
    }
  ): Promise<void> {
    try {
      // This would integrate with your notification system
      // For now, just console log critical errors
      if (error.severity === ErrorSeverity.CRITICAL) {
        console.error('CRITICAL PAYMENT ERROR:', {
          type: error.type,
          message: error.message,
          context,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  /**
   * Create secure API response
   */
  private createErrorResponse(
    error: PaymentError,
    context: {
      userId?: string;
      operation?: string;
    }
  ): NextResponse {
    // Base response object
    const response: any = {
      success: false,
      error: {
        type: error.type,
        message: error.userMessage,
        code: error.code,
      },
      timestamp: new Date().toISOString(),
    };

    // Add request ID for tracking
    response.requestId = this.generateRequestId(context.userId);

    // Add development-specific information
    if (this.isDevelopment) {
      response.debug = {
        originalMessage: error.message,
        details: error.details,
        stack: error.stack,
      };
    }

    // Add specific error information based on type
    switch (error.type) {
      case PaymentErrorType.VALIDATION_ERROR:
        response.validation = error.details.validation || [];
        break;
      case PaymentErrorType.RATE_LIMIT_EXCEEDED:
        response.retryAfter = error.details.retryAfter || 60;
        break;
      case PaymentErrorType.CARD_DECLINED:
        response.declineCode = error.details.declineCode;
        break;
    }

    return NextResponse.json(response, { status: error.code });
  }

  /**
   * Generate unique request ID for error tracking
   */
  private generateRequestId(userId?: string): string {
    const timestamp = Date.now().toString(36);
    const randomString = Math.random().toString(36).substring(2, 8);
    const userPrefix = userId ? userId.substring(0, 8) : 'anon';
    return `${userPrefix}-${timestamp}-${randomString}`;
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: PaymentError): boolean {
    const retryableTypes = [
      PaymentErrorType.EXTERNAL_SERVICE_ERROR,
      PaymentErrorType.DATABASE_ERROR,
      PaymentErrorType.STRIPE_ERROR,
    ];
    
    return retryableTypes.includes(error.type) && error.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Get retry delay for retryable errors
   */
  static getRetryDelay(error: PaymentError, attempt: number): number {
    if (!this.isRetryableError(error)) {
      return 0;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt - 1), 16000);
  }
}

// Singleton instance
export const paymentErrorHandler = new PaymentErrorHandler();

// Utility functions for creating common errors
export function createValidationError(
  message: string,
  validationErrors: any[] = []
): PaymentError {
  return new PaymentError(
    PaymentErrorType.VALIDATION_ERROR,
    message,
    {
      code: 400,
      severity: ErrorSeverity.LOW,
      details: { validation: validationErrors },
      shouldLog: false, // Don't log validation errors
    }
  );
}

export function createAuthorizationError(
  message: string = 'Access denied'
): PaymentError {
  return new PaymentError(
    PaymentErrorType.FORBIDDEN,
    message,
    {
      code: 403,
      severity: ErrorSeverity.MEDIUM,
    }
  );
}

export function createNotFoundError(
  resource: string,
  id?: string
): PaymentError {
  const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
  let type: PaymentErrorType;

  switch (resource.toLowerCase()) {
    case 'booking':
      type = PaymentErrorType.BOOKING_NOT_FOUND;
      break;
    case 'payment':
      type = PaymentErrorType.PAYMENT_NOT_FOUND;
      break;
    case 'caregiver':
      type = PaymentErrorType.CAREGIVER_NOT_FOUND;
      break;
    case 'user':
      type = PaymentErrorType.USER_NOT_FOUND;
      break;
    default:
      type = PaymentErrorType.EXTERNAL_SERVICE_ERROR;
  }

  return new PaymentError(type, message, {
    code: 404,
    severity: ErrorSeverity.LOW,
    details: { resource, id },
  });
}

export function createRateLimitError(
  retryAfter: number = 60
): PaymentError {
  return new PaymentError(
    PaymentErrorType.RATE_LIMIT_EXCEEDED,
    'Too many requests',
    {
      code: 429,
      severity: ErrorSeverity.LOW,
      details: { retryAfter },
      shouldLog: false,
    }
  );
}

export function createStripeError(
  stripeError: any
): PaymentError {
  let type = PaymentErrorType.STRIPE_ERROR;
  let severity = ErrorSeverity.MEDIUM;
  let code = 502;

  // Handle specific Stripe error types
  if (stripeError.type === 'card_error') {
    type = PaymentErrorType.CARD_DECLINED;
    severity = ErrorSeverity.LOW;
    code = 402;
  } else if (stripeError.type === 'rate_limit_error') {
    type = PaymentErrorType.RATE_LIMIT_EXCEEDED;
    severity = ErrorSeverity.LOW;
    code = 429;
  }

  return new PaymentError(type, stripeError.message || 'Payment processing error', {
    code,
    severity,
    details: {
      stripeType: stripeError.type,
      stripeCode: stripeError.code,
      declineCode: stripeError.decline_code,
      paymentIntentId: stripeError.payment_intent?.id,
    },
  });
}

export function createDatabaseError(
  operation: string,
  originalError?: Error
): PaymentError {
  return new PaymentError(
    PaymentErrorType.DATABASE_ERROR,
    `Database error during ${operation}`,
    {
      code: 503,
      severity: ErrorSeverity.HIGH,
      details: {
        operation,
        originalMessage: originalError?.message,
      },
    }
  );
}