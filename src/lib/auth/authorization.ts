/**
 * Authorization utilities for payment operations
 * Implements secure ownership checks and permission validation
 */

import { db } from '@/lib/db';
import { PaymentAuditLogger } from '@/lib/audit/payment-audit';

// User roles and their permissions
export enum UserRole {
  ADMIN = 'ADMIN',
  PARENT = 'PARENT',
  CAREGIVER = 'CAREGIVER',
}

// Permission types for different operations
export enum PaymentPermission {
  CREATE_SPLIT_PAYMENT = 'CREATE_SPLIT_PAYMENT',
  ADD_TIP = 'ADD_TIP',
  CREATE_PAYMENT_PLAN = 'CREATE_PAYMENT_PLAN',
  PROCESS_REFUND = 'PROCESS_REFUND',
  VIEW_PAYMENT = 'VIEW_PAYMENT',
  MANAGE_PAYMENT_METHODS = 'MANAGE_PAYMENT_METHODS',
  RELEASE_ESCROW = 'RELEASE_ESCROW',
  VIEW_ALL_PAYMENTS = 'VIEW_ALL_PAYMENTS',
  ADMIN_OVERRIDE = 'ADMIN_OVERRIDE',
}

// Role-based permissions matrix
const ROLE_PERMISSIONS: Record<UserRole, PaymentPermission[]> = {
  [UserRole.ADMIN]: [
    PaymentPermission.CREATE_SPLIT_PAYMENT,
    PaymentPermission.ADD_TIP,
    PaymentPermission.CREATE_PAYMENT_PLAN,
    PaymentPermission.PROCESS_REFUND,
    PaymentPermission.VIEW_PAYMENT,
    PaymentPermission.MANAGE_PAYMENT_METHODS,
    PaymentPermission.RELEASE_ESCROW,
    PaymentPermission.VIEW_ALL_PAYMENTS,
    PaymentPermission.ADMIN_OVERRIDE,
  ],
  [UserRole.PARENT]: [
    PaymentPermission.CREATE_SPLIT_PAYMENT,
    PaymentPermission.ADD_TIP,
    PaymentPermission.CREATE_PAYMENT_PLAN,
    PaymentPermission.VIEW_PAYMENT,
    PaymentPermission.MANAGE_PAYMENT_METHODS,
  ],
  [UserRole.CAREGIVER]: [
    PaymentPermission.VIEW_PAYMENT,
    PaymentPermission.MANAGE_PAYMENT_METHODS,
    PaymentPermission.RELEASE_ESCROW,
  ],
};

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  stripeCustomerId?: string;
}

export interface AuthorizationContext {
  user: AuthUser;
  resource?: any;
  operation: PaymentPermission;
  metadata?: Record<string, any>;
}

/**
 * Authorization service for payment operations
 */
export class PaymentAuthorizationService {
  private auditLogger: PaymentAuditLogger;

  constructor() {
    this.auditLogger = new PaymentAuditLogger();
  }

  /**
   * Check if user has required permission
   */
  hasPermission(userRole: UserRole, permission: PaymentPermission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Verify booking ownership for payment operations
   */
  async verifyBookingOwnership(
    userId: string,
    bookingId: string,
    requiredRole?: 'parent' | 'caregiver' | 'both'
  ): Promise<{ isOwner: boolean; booking?: any; userRole?: 'parent' | 'caregiver' }> {
    try {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: {
          parent: { select: { id: true, email: true } },
          caregiver: { select: { id: true, email: true } },
          caregiverData: { select: { userId: true } },
        },
      });

      if (!booking) {
        await this.auditLogger.logSecurityEvent({
          type: 'BOOKING_NOT_FOUND',
          userId,
          resourceId: bookingId,
          details: { bookingId },
          severity: 'MEDIUM',
        });
        return { isOwner: false };
      }

      const isParent = booking.parentId === userId;
      const isCaregiver = booking.caregiverData?.userId === userId || booking.caregiverId === userId;
      
      let userRole: 'parent' | 'caregiver' | undefined;
      if (isParent) userRole = 'parent';
      if (isCaregiver) userRole = 'caregiver';

      let isOwner = false;
      if (requiredRole === 'parent') {
        isOwner = isParent;
      } else if (requiredRole === 'caregiver') {
        isOwner = isCaregiver;
      } else {
        isOwner = isParent || isCaregiver;
      }

      if (!isOwner) {
        await this.auditLogger.logSecurityEvent({
          type: 'UNAUTHORIZED_BOOKING_ACCESS',
          userId,
          resourceId: bookingId,
          details: { 
            bookingId, 
            parentId: booking.parentId, 
            caregiverId: booking.caregiverData?.userId,
            requiredRole 
          },
          severity: 'HIGH',
        });
      }

      return { isOwner, booking, userRole };
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        type: 'AUTHORIZATION_ERROR',
        userId,
        resourceId: bookingId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', bookingId },
        severity: 'HIGH',
      });
      return { isOwner: false };
    }
  }

  /**
   * Verify payment ownership
   */
  async verifyPaymentOwnership(
    userId: string,
    paymentId: string
  ): Promise<{ isOwner: boolean; payment?: any }> {
    try {
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              parent: { select: { id: true } },
              caregiverData: { select: { userId: true } },
            },
          },
          user: { select: { id: true } },
        },
      });

      if (!payment) {
        await this.auditLogger.logSecurityEvent({
          type: 'PAYMENT_NOT_FOUND',
          userId,
          resourceId: paymentId,
          details: { paymentId },
          severity: 'MEDIUM',
        });
        return { isOwner: false };
      }

      const isOwner = 
        payment.userId === userId ||
        payment.booking?.parentId === userId ||
        payment.booking?.caregiverData?.userId === userId;

      if (!isOwner) {
        await this.auditLogger.logSecurityEvent({
          type: 'UNAUTHORIZED_PAYMENT_ACCESS',
          userId,
          resourceId: paymentId,
          details: { 
            paymentId, 
            paymentUserId: payment.userId,
            bookingParentId: payment.booking?.parentId,
            bookingCaregiverId: payment.booking?.caregiverData?.userId,
          },
          severity: 'HIGH',
        });
      }

      return { isOwner, payment };
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        type: 'AUTHORIZATION_ERROR',
        userId,
        resourceId: paymentId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', paymentId },
        severity: 'HIGH',
      });
      return { isOwner: false };
    }
  }

  /**
   * Verify caregiver ownership
   */
  async verifyCaregiverOwnership(
    userId: string,
    caregiverId: string
  ): Promise<{ isOwner: boolean; caregiver?: any }> {
    try {
      const caregiver = await db.caregiver.findUnique({
        where: { id: caregiverId },
        include: {
          user: { select: { id: true, email: true } },
        },
      });

      if (!caregiver) {
        await this.auditLogger.logSecurityEvent({
          type: 'CAREGIVER_NOT_FOUND',
          userId,
          resourceId: caregiverId,
          details: { caregiverId },
          severity: 'MEDIUM',
        });
        return { isOwner: false };
      }

      const isOwner = caregiver.userId === userId;

      if (!isOwner) {
        await this.auditLogger.logSecurityEvent({
          type: 'UNAUTHORIZED_CAREGIVER_ACCESS',
          userId,
          resourceId: caregiverId,
          details: { caregiverId, caregiverUserId: caregiver.userId },
          severity: 'HIGH',
        });
      }

      return { isOwner, caregiver };
    } catch (error) {
      await this.auditLogger.logSecurityEvent({
        type: 'AUTHORIZATION_ERROR',
        userId,
        resourceId: caregiverId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', caregiverId },
        severity: 'HIGH',
      });
      return { isOwner: false };
    }
  }

  /**
   * Comprehensive authorization check for payment operations
   */
  async authorizePaymentOperation(
    context: AuthorizationContext
  ): Promise<{ authorized: boolean; reason?: string }> {
    const { user, operation } = context;

    // Check if user is active
    if (!user.isActive) {
      await this.auditLogger.logSecurityEvent({
        type: 'INACTIVE_USER_ACCESS',
        userId: user.id,
        details: { operation, userEmail: user.email },
        severity: 'HIGH',
      });
      return { authorized: false, reason: 'User account is inactive' };
    }

    // Check role-based permissions
    if (!this.hasPermission(user.role, operation)) {
      await this.auditLogger.logSecurityEvent({
        type: 'INSUFFICIENT_PERMISSIONS',
        userId: user.id,
        details: { 
          operation, 
          userRole: user.role, 
          requiredPermission: operation 
        },
        severity: 'MEDIUM',
      });
      return { authorized: false, reason: 'Insufficient permissions for this operation' };
    }

    // Additional resource-specific checks
    if (context.resource) {
      const resourceCheck = await this.checkResourceAccess(user, context.resource, operation);
      if (!resourceCheck.authorized) {
        return resourceCheck;
      }
    }

    // Log successful authorization
    await this.auditLogger.logPaymentEvent({
      type: 'AUTHORIZATION_SUCCESS',
      userId: user.id,
      details: { operation, userRole: user.role },
    });

    return { authorized: true };
  }

  /**
   * Check access to specific resources
   */
  private async checkResourceAccess(
    user: AuthUser,
    resource: any,
    operation: PaymentPermission
  ): Promise<{ authorized: boolean; reason?: string }> {
    // Skip resource checks for admins (they have override permissions)
    if (user.role === UserRole.ADMIN && this.hasPermission(user.role, PaymentPermission.ADMIN_OVERRIDE)) {
      return { authorized: true };
    }

    // Check booking ownership for booking-related operations
    if (resource.bookingId) {
      const bookingCheck = await this.verifyBookingOwnership(user.id, resource.bookingId);
      if (!bookingCheck.isOwner) {
        return { authorized: false, reason: 'Access denied: not authorized for this booking' };
      }
    }

    // Check payment ownership for payment-related operations
    if (resource.paymentId) {
      const paymentCheck = await this.verifyPaymentOwnership(user.id, resource.paymentId);
      if (!paymentCheck.isOwner) {
        return { authorized: false, reason: 'Access denied: not authorized for this payment' };
      }
    }

    // Check caregiver ownership for caregiver-specific operations
    if (resource.caregiverId && operation !== PaymentPermission.CREATE_SPLIT_PAYMENT) {
      const caregiverCheck = await this.verifyCaregiverOwnership(user.id, resource.caregiverId);
      if (!caregiverCheck.isOwner) {
        return { authorized: false, reason: 'Access denied: not authorized for this caregiver' };
      }
    }

    return { authorized: true };
  }

  /**
   * Rate limiting check for payment operations
   */
  async checkRateLimit(
    userId: string,
    operation: PaymentPermission,
    windowMs: number = 60000, // 1 minute
    maxAttempts: number = 10
  ): Promise<{ allowed: boolean; resetTime?: number }> {
    const key = `rate_limit:${userId}:${operation}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // This is a simplified implementation
      // In production, you'd use Redis or another proper rate limiting solution
      const recentAttempts = await db.auditLog.count({
        where: {
          userId,
          eventType: `RATE_LIMIT_${operation}`,
          timestamp: {
            gte: new Date(windowStart),
          },
        },
      });

      if (recentAttempts >= maxAttempts) {
        await this.auditLogger.logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          userId,
          details: { 
            operation, 
            attempts: recentAttempts, 
            maxAttempts, 
            windowMs 
          },
          severity: 'MEDIUM',
        });
        return { allowed: false, resetTime: windowStart + windowMs };
      }

      // Log the attempt for rate limiting
      await this.auditLogger.logPaymentEvent({
        type: `RATE_LIMIT_${operation}`,
        userId,
        details: { operation, attempt: recentAttempts + 1 },
      });

      return { allowed: true };
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      await this.auditLogger.logSecurityEvent({
        type: 'RATE_LIMIT_ERROR',
        userId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', operation },
        severity: 'LOW',
      });
      return { allowed: true };
    }
  }

  /**
   * Validate IP address and location for suspicious activity
   */
  async validateRequestOrigin(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ valid: boolean; risk: 'LOW' | 'MEDIUM' | 'HIGH' }> {
    try {
      // This is a simplified implementation
      // In production, you'd integrate with IP geolocation and fraud detection services
      
      if (!ipAddress) {
        return { valid: true, risk: 'LOW' };
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /^10\./, // Private networks
        /^192\.168\./, // Private networks
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private networks
      ];

      const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(ipAddress));
      
      if (isSuspicious) {
        await this.auditLogger.logSecurityEvent({
          type: 'SUSPICIOUS_IP_ACCESS',
          userId,
          details: { ipAddress, userAgent },
          severity: 'MEDIUM',
        });
        return { valid: true, risk: 'MEDIUM' };
      }

      return { valid: true, risk: 'LOW' };
    } catch (error) {
      return { valid: true, risk: 'LOW' }; // Fail open for availability
    }
  }
}

// Singleton instance
export const paymentAuthService = new PaymentAuthorizationService();

// Utility functions for common authorization patterns
export async function requirePaymentAccess(
  user: AuthUser,
  paymentId: string
): Promise<{ payment: any }> {
  const { isOwner, payment } = await paymentAuthService.verifyPaymentOwnership(user.id, paymentId);
  
  if (!isOwner && user.role !== UserRole.ADMIN) {
    throw new Error('Access denied: You are not authorized to access this payment');
  }

  if (!payment) {
    throw new Error('Payment not found');
  }

  return { payment };
}

export async function requireBookingAccess(
  user: AuthUser,
  bookingId: string,
  requiredRole?: 'parent' | 'caregiver'
): Promise<{ booking: any }> {
  const { isOwner, booking } = await paymentAuthService.verifyBookingOwnership(
    user.id,
    bookingId,
    requiredRole
  );
  
  if (!isOwner && user.role !== UserRole.ADMIN) {
    throw new Error('Access denied: You are not authorized to access this booking');
  }

  if (!booking) {
    throw new Error('Booking not found');
  }

  return { booking };
}

export async function requireCaregiverAccess(
  user: AuthUser,
  caregiverId: string
): Promise<{ caregiver: any }> {
  const { isOwner, caregiver } = await paymentAuthService.verifyCaregiverOwnership(user.id, caregiverId);
  
  if (!isOwner && user.role !== UserRole.ADMIN) {
    throw new Error('Access denied: You are not authorized to access this caregiver profile');
  }

  if (!caregiver) {
    throw new Error('Caregiver not found');
  }

  return { caregiver };
}