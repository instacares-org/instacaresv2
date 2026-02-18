/**
 * Audit logging system for payment operations
 * Provides comprehensive logging for financial transactions and security events
 */

import { db } from '@/lib/db';

// Audit event types
export enum AuditEventType {
  // Payment events
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  
  // Split payment events
  SPLIT_PAYMENT_CREATED = 'SPLIT_PAYMENT_CREATED',
  SPLIT_PAYMENT_COMPLETED = 'SPLIT_PAYMENT_COMPLETED',
  
  // Tip events
  TIP_ADDED = 'TIP_ADDED',
  TIP_PROCESSED = 'TIP_PROCESSED',
  
  // Payment plan events
  PAYMENT_PLAN_CREATED = 'PAYMENT_PLAN_CREATED',
  PAYMENT_PLAN_UPDATED = 'PAYMENT_PLAN_UPDATED',
  PAYMENT_PLAN_CANCELLED = 'PAYMENT_PLAN_CANCELLED',
  
  // Refund events
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  REFUND_FAILED = 'REFUND_FAILED',
  
  // Escrow events
  ESCROW_CREATED = 'ESCROW_CREATED',
  ESCROW_RELEASED = 'ESCROW_RELEASED',
  ESCROW_DISPUTED = 'ESCROW_DISPUTED',
  
  // Security events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  IP_BLOCKED = 'IP_BLOCKED',
  
  // Authorization events
  AUTHORIZATION_SUCCESS = 'AUTHORIZATION_SUCCESS',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // System events
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  STRIPE_WEBHOOK_RECEIVED = 'STRIPE_WEBHOOK_RECEIVED',
  STRIPE_WEBHOOK_PROCESSED = 'STRIPE_WEBHOOK_PROCESSED',
  
  // Admin events
  ADMIN_PAYMENT_OVERRIDE = 'ADMIN_PAYMENT_OVERRIDE',
  ADMIN_REFUND_APPROVED = 'ADMIN_REFUND_APPROVED',
  MANUAL_PAYMENT_ADJUSTMENT = 'MANUAL_PAYMENT_ADJUSTMENT',
}

// Audit severity levels
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Audit event interface
export interface AuditEvent {
  type: AuditEventType;
  userId?: string;
  resourceId?: string;
  details: Record<string, any>;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// Security event interface
export interface SecurityEvent extends Omit<AuditEvent, 'type'> {
  type: string;
  severity: AuditSeverity;
}

/**
 * Payment audit logging service
 */
export class PaymentAuditLogger {
  private retentionDays: number = 2555; // 7 years retention for financial records
  private isEnabled: boolean = true;

  constructor() {
    // Disable logging in test environment
    if (process.env.NODE_ENV === 'test') {
      this.isEnabled = false;
    }
  }

  /**
   * Log a payment-related event
   */
  async logPaymentEvent(event: AuditEvent): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.createAuditLog({
        ...event,
        severity: event.severity || AuditSeverity.MEDIUM,
      });
    } catch (error) {
      console.error('Failed to log payment event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.createAuditLog(event as AuditEvent);
      
      // For critical security events, also log to external monitoring
      if (event.severity === AuditSeverity.CRITICAL) {
        await this.alertSecurityTeam(event);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Log payment creation with full details
   */
  async logPaymentCreation(data: {
    paymentId: string;
    userId: string;
    bookingId?: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    stripePaymentIntentId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.PAYMENT_CREATED,
      userId: data.userId,
      resourceId: data.paymentId,
      details: {
        bookingId: data.bookingId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        stripePaymentIntentId: data.stripePaymentIntentId,
        ...data.metadata,
      },
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log payment confirmation
   */
  async logPaymentConfirmation(data: {
    paymentId: string;
    userId: string;
    amount: number;
    stripeChargeId?: string;
    processingTime: number;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.PAYMENT_CONFIRMED,
      userId: data.userId,
      resourceId: data.paymentId,
      details: {
        amount: data.amount,
        stripeChargeId: data.stripeChargeId,
        processingTime: data.processingTime,
        confirmedAt: new Date().toISOString(),
      },
      severity: AuditSeverity.LOW,
    });
  }

  /**
   * Log refund processing
   */
  async logRefund(data: {
    paymentId: string;
    refundId: string;
    userId: string;
    amount: number;
    reason: string;
    adminId?: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.REFUND_PROCESSED,
      userId: data.userId,
      resourceId: data.paymentId,
      details: {
        refundId: data.refundId,
        amount: data.amount,
        reason: data.reason,
        adminId: data.adminId,
        refundedAt: new Date().toISOString(),
      },
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log split payment creation
   */
  async logSplitPayment(data: {
    bookingId: string;
    totalAmount: number;
    parties: Array<{ userId: string; amount: number; percentage: number }>;
    initiatedBy: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.SPLIT_PAYMENT_CREATED,
      userId: data.initiatedBy,
      resourceId: data.bookingId,
      details: {
        totalAmount: data.totalAmount,
        partiesCount: data.parties.length,
        parties: data.parties,
        createdAt: new Date().toISOString(),
      },
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log tip addition
   */
  async logTipAddition(data: {
    bookingId: string;
    tipAmount: number;
    userId: string;
    caregiverId: string;
    paymentIntentId: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.TIP_ADDED,
      userId: data.userId,
      resourceId: data.bookingId,
      details: {
        tipAmount: data.tipAmount,
        caregiverId: data.caregiverId,
        paymentIntentId: data.paymentIntentId,
        addedAt: new Date().toISOString(),
      },
      severity: AuditSeverity.LOW,
    });
  }

  /**
   * Log payment plan creation
   */
  async logPaymentPlan(data: {
    userId: string;
    caregiverId: string;
    totalAmount: number;
    installments: number;
    frequency: string;
    subscriptionId: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: AuditEventType.PAYMENT_PLAN_CREATED,
      userId: data.userId,
      resourceId: data.subscriptionId,
      details: {
        caregiverId: data.caregiverId,
        totalAmount: data.totalAmount,
        installments: data.installments,
        frequency: data.frequency,
        createdAt: new Date().toISOString(),
      },
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(data: {
    userId?: string;
    activity: string;
    riskScore?: number;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: data.userId,
      details: {
        activity: data.activity,
        riskScore: data.riskScore,
        ...data.details,
      },
      severity: data.riskScore && data.riskScore > 0.8 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  /**
   * Log Stripe webhook processing
   */
  async logStripeWebhook(data: {
    eventId: string;
    eventType: string;
    processed: boolean;
    processingTime?: number;
    error?: string;
  }): Promise<void> {
    await this.logPaymentEvent({
      type: data.processed 
        ? AuditEventType.STRIPE_WEBHOOK_PROCESSED 
        : AuditEventType.STRIPE_WEBHOOK_RECEIVED,
      resourceId: data.eventId,
      details: {
        eventType: data.eventType,
        processed: data.processed,
        processingTime: data.processingTime,
        error: data.error,
        timestamp: new Date().toISOString(),
      },
      severity: data.error ? AuditSeverity.HIGH : AuditSeverity.LOW,
    });
  }

  /**
   * Derive a resource category string from the event type
   */
  private getResourceFromEventType(eventType: string): string {
    if (eventType.startsWith('PAYMENT_') || eventType.startsWith('SPLIT_PAYMENT')) return 'payment';
    if (eventType.startsWith('REFUND_')) return 'refund';
    if (eventType.startsWith('TIP_')) return 'tip';
    if (eventType.startsWith('ESCROW_')) return 'escrow';
    if (eventType.startsWith('STRIPE_')) return 'stripe';
    if (eventType.startsWith('ADMIN_') || eventType.startsWith('MANUAL_')) return 'admin';
    return 'security';
  }

  /**
   * Create audit log entry in database
   * Maps AuditEvent fields to the Prisma AuditLog schema:
   *   action    <- event.type
   *   adminId   <- event.userId (the acting user)
   *   adminEmail <- 'system' placeholder (not available in event context)
   *   resource  <- derived from event type category
   *   resourceId, ipAddress, userAgent <- direct mapping
   *   details   <- merged event.details + severity, sessionId, metadata
   *   createdAt <- auto-set by Prisma default
   */
  private async createAuditLog(event: AuditEvent): Promise<void> {
    try {
      const mergedDetails: Record<string, unknown> = {
        ...event.details,
        severity: event.severity || AuditSeverity.MEDIUM,
        ...(event.sessionId && { sessionId: event.sessionId }),
        ...(event.metadata && { metadata: event.metadata }),
      };

      await db.auditLog.create({
        data: {
          action: event.type,
          adminId: event.userId || 'system',
          adminEmail: 'system@instacares.com',
          resource: this.getResourceFromEventType(event.type),
          resourceId: event.resourceId,
          details: mergedDetails,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
      });
    } catch (error) {
      // Fallback to console logging if database fails
      console.error('Database audit log failed, using console fallback:', {
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Alert security team for critical events
   */
  private async alertSecurityTeam(event: SecurityEvent): Promise<void> {
    try {
      // This would integrate with your alerting system (e.g., Slack, email, PagerDuty)
      console.error('CRITICAL SECURITY EVENT:', {
        type: event.type,
        userId: event.userId,
        details: event.details,
        timestamp: new Date().toISOString(),
      });

      // In production, you'd send alerts to monitoring systems
      // await sendSlackAlert(event);
      // await sendEmailAlert(event);
      // await createPagerDutyIncident(event);
    } catch (error) {
      console.error('Failed to alert security team:', error);
    }
  }

  /**
   * Query audit logs with filtering
   * Maps conceptual filter fields to actual Prisma AuditLog schema fields:
   *   userId    -> adminId
   *   eventType -> action
   *   timestamp -> createdAt
   *   severity  -> stored inside details JSON (filtered in-memory if needed)
   */
  async queryAuditLogs(filters: {
    userId?: string;
    eventType?: AuditEventType;
    resourceId?: string;
    severity?: AuditSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const whereClause: Record<string, unknown> = {};

    if (filters.userId) {
      whereClause.adminId = filters.userId;
    }

    if (filters.eventType) {
      whereClause.action = filters.eventType;
    }

    if (filters.resourceId) {
      whereClause.resourceId = filters.resourceId;
    }

    if (filters.startDate || filters.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (filters.startDate) {
        createdAtFilter.gte = filters.startDate;
      }
      if (filters.endDate) {
        createdAtFilter.lte = filters.endDate;
      }
      whereClause.createdAt = createdAtFilter;
    }

    const results = await db.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    // If severity filter is specified, filter in-memory since severity is stored in details JSON
    if (filters.severity) {
      return results.filter(log => {
        const details = log.details as Record<string, unknown> | null;
        return details?.severity === filters.severity;
      });
    }

    return results;
  }

  /**
   * Generate audit report for a specific time period
   * Maps: timestamp -> createdAt, userId -> adminId, eventType -> action
   * severity is extracted from the details JSON field
   */
  async generateAuditReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    suspiciousActivities: number;
    paymentVolume: { amount: number; count: number };
  }> {
    const whereClause: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (userId) {
      whereClause.adminId = userId;
    }

    const logs = await db.auditLog.findMany({
      where: whereClause,
      select: {
        action: true,
        details: true,
      },
    });

    const report = {
      totalEvents: logs.length,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      suspiciousActivities: 0,
      paymentVolume: { amount: 0, count: 0 },
    };

    logs.forEach(log => {
      const eventType = log.action;
      const details = log.details as Record<string, unknown> | null;
      const severity = (details?.severity as string) || AuditSeverity.MEDIUM;

      // Count by event type
      report.eventsByType[eventType] = (report.eventsByType[eventType] || 0) + 1;

      // Count by severity
      report.eventsBySeverity[severity] = (report.eventsBySeverity[severity] || 0) + 1;

      // Count suspicious activities
      if (eventType.includes('SUSPICIOUS') || eventType.includes('FRAUD')) {
        report.suspiciousActivities++;
      }

      // Calculate payment volume
      if (eventType === 'PAYMENT_CONFIRMED' && details?.amount) {
        report.paymentVolume.amount += Number(details.amount);
        report.paymentVolume.count++;
      }
    });

    return report;
  }

  /**
   * Clean up old audit logs (retention policy)
   * Note: severity is stored in the details JSON, so critical event filtering
   * is done by excluding actions that are known critical security events.
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    // Critical security actions that should be retained longer
    const criticalActions = [
      AuditEventType.FRAUD_DETECTED,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.IP_BLOCKED,
    ];

    const result = await db.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        // Keep critical security events longer
        action: {
          notIn: criticalActions,
        },
      },
    });

    return result.count;
  }

  /**
   * Export audit logs for compliance
   * Maps: timestamp -> createdAt, eventType -> action, userId -> adminId
   * severity is extracted from the details JSON field
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    const logs = await db.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (format === 'csv') {
      // Convert to CSV format for compliance exports
      const headers = ['timestamp', 'eventType', 'userId', 'resourceId', 'severity', 'details'];
      const rows = logs.map(log => {
        const details = log.details as Record<string, unknown> | null;
        const severity = (details?.severity as string) || AuditSeverity.MEDIUM;
        return [
          log.createdAt.toISOString(),
          log.action,
          log.adminId || '',
          log.resourceId || '',
          severity,
          JSON.stringify(log.details),
        ];
      });

      return {
        headers,
        rows,
        filename: `audit_export_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`,
      };
    }

    return {
      logs,
      exportDate: new Date().toISOString(),
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      totalRecords: logs.length,
    };
  }
}

// Singleton instance
export const paymentAuditLogger = new PaymentAuditLogger();

// Utility functions for common audit operations
export async function auditPaymentCreation(data: {
  paymentId: string;
  userId: string;
  bookingId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await paymentAuditLogger.logPaymentCreation(data);
}

export async function auditPaymentConfirmation(data: {
  paymentId: string;
  userId: string;
  amount: number;
  stripeChargeId?: string;
  processingTime: number;
}): Promise<void> {
  await paymentAuditLogger.logPaymentConfirmation(data);
}

export async function auditRefundProcessing(data: {
  paymentId: string;
  refundId: string;
  userId: string;
  amount: number;
  reason: string;
  adminId?: string;
}): Promise<void> {
  await paymentAuditLogger.logRefund(data);
}

export async function auditSuspiciousActivity(data: {
  userId?: string;
  activity: string;
  riskScore?: number;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
}): Promise<void> {
  await paymentAuditLogger.logSuspiciousActivity(data);
}