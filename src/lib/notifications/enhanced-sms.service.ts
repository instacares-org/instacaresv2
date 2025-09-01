import twilio from 'twilio';
import { prisma } from '@/lib/prisma';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface EnhancedSMSOptions {
  to: string;
  body: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  type: string; // BOOKING_REMINDER, PICKUP_REMINDER, etc.
  userId?: string;
  contextType?: string;
  contextId?: string;
  maxRetries?: number;
  templateId: string;
}

export interface SMSResult {
  success: boolean;
  notificationId?: string;
  providerId?: string;
  error?: string;
  retryAfter?: number;
}

export class EnhancedSMSService {
  private from: string;
  private isEnabled: boolean;
  private rateLimiter: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
  private readonly DEFAULT_RATE_LIMIT = 50; // messages per hour per recipient

  constructor() {
    this.from = process.env.TWILIO_PHONE_NUMBER || '';
    this.isEnabled = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && this.from);
    
    if (!this.isEnabled) {
      console.warn('SMS Service not fully configured. Missing Twilio credentials or phone number.');
    }
  }

  /**
   * Format phone number to E.164 format with validation
   */
  private formatPhoneNumber(phone: string): { formatted: string; isValid: boolean } {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Validation rules
    if (digits.length < 10 || digits.length > 15) {
      return { formatted: '', isValid: false };
    }
    
    let formatted = '';
    
    // North American numbers
    if (digits.length === 10) {
      formatted = `+1${digits}`;
    }
    // Numbers with country code
    else if (digits.length === 11 && digits.startsWith('1')) {
      formatted = `+${digits}`;
    }
    // International numbers
    else {
      formatted = phone.startsWith('+') ? phone : `+${digits}`;
    }
    
    return { formatted, isValid: true };
  }

  /**
   * Check rate limits for recipient
   */
  private checkRateLimit(to: string, priority: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;
    
    // Get or initialize rate limit tracking
    const timestamps = this.rateLimiter.get(to) || [];
    
    // Remove old timestamps
    const recentTimestamps = timestamps.filter(t => t > windowStart);
    this.rateLimiter.set(to, recentTimestamps);
    
    // Check if rate limit exceeded
    const limit = priority === 'CRITICAL' ? this.DEFAULT_RATE_LIMIT * 2 : this.DEFAULT_RATE_LIMIT;
    
    if (recentTimestamps.length >= limit) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const retryAfter = oldestTimestamp + this.RATE_LIMIT_WINDOW - now;
      return { allowed: false, retryAfter: Math.ceil(retryAfter / 1000) };
    }
    
    return { allowed: true };
  }

  /**
   * Validate SMS content for legal compliance
   */
  private validateContent(content: string, type: string): { valid: boolean; error?: string } {
    // Maximum SMS length (Twilio limit)
    if (content.length > 1600) {
      return { valid: false, error: 'SMS content exceeds maximum length of 1600 characters' };
    }
    
    // Check for required legal disclaimers for marketing messages
    if (type.includes('MARKETING') && !content.toLowerCase().includes('stop')) {
      return { valid: false, error: 'Marketing SMS must include STOP instructions' };
    }
    
    // Check for spam-like content
    const spamPatterns = [
      /\$\$\$/g,
      /FREE!/g,
      /URGENT.*CLICK/gi,
      /LIMITED.*TIME.*OFFER/gi
    ];
    
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        return { valid: false, error: 'Content contains potentially spam-like patterns' };
      }
    }
    
    return { valid: true };
  }

  /**
   * Log notification event to database
   */
  private async logNotificationEvent(
    options: EnhancedSMSOptions,
    status: 'PENDING' | 'SENT' | 'FAILED',
    providerId?: string,
    error?: string
  ): Promise<string> {
    try {
      const notification = await prisma.notificationEvent.create({
        data: {
          type: options.type as any,
          channel: 'SMS',
          templateId: options.templateId,
          priority: (options.priority || 'NORMAL') as any,
          recipientId: options.userId,
          recipientPhone: options.to,
          content: options.body,
          status: status as any,
          providerId,
          errorMessage: error,
          retryCount: 0,
          maxRetries: options.maxRetries || 3,
          contextType: options.contextType,
          contextId: options.contextId,
          isTransactional: true,
          triggeredBy: 'system'
        }
      });
      
      return notification.id;
    } catch (dbError) {
      console.error('Failed to log notification event:', dbError);
      throw dbError;
    }
  }

  /**
   * Update notification status
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: 'SENT' | 'FAILED' | 'DELIVERED',
    providerId?: string,
    error?: string
  ): Promise<void> {
    try {
      await prisma.notificationEvent.update({
        where: { id: notificationId },
        data: {
          status: status as any,
          ...(providerId && { providerId }),
          ...(status === 'SENT' && { sentAt: new Date() }),
          ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
          ...(status === 'FAILED' && { 
            failedAt: new Date(),
            errorMessage: error 
          })
        }
      });
    } catch (dbError) {
      console.error('Failed to update notification status:', dbError);
    }
  }

  /**
   * Enhanced SMS send with full tracking and reliability
   */
  async sendEnhanced(options: EnhancedSMSOptions): Promise<SMSResult> {
    const priority = options.priority || 'NORMAL';
    
    // Validate phone number
    const { formatted: formattedPhone, isValid } = this.formatPhoneNumber(options.to);
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid phone number format'
      };
    }
    
    // Validate content
    const contentValidation = this.validateContent(options.body, options.type);
    if (!contentValidation.valid) {
      return {
        success: false,
        error: contentValidation.error
      };
    }
    
    // Check rate limits (unless CRITICAL)
    if (priority !== 'CRITICAL') {
      const rateLimitCheck = this.checkRateLimit(formattedPhone, priority);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter
        };
      }
    }
    
    // Log notification attempt
    const notificationId = await this.logNotificationEvent(options, 'PENDING');
    
    // If SMS is disabled (development), simulate success
    if (!this.isEnabled) {
      console.log('SMS Service disabled - simulating success:', {
        to: formattedPhone,
        body: options.body,
        priority,
        type: options.type
      });
      
      await this.updateNotificationStatus(notificationId, 'SENT', 'dev-mode-' + Date.now().toString());
      
      return {
        success: true,
        notificationId,
        providerId: 'dev-mode'
      };
    }
    
    try {
      // Add to rate limiter tracking
      const timestamps = this.rateLimiter.get(formattedPhone) || [];
      timestamps.push(Date.now());
      this.rateLimiter.set(formattedPhone, timestamps);
      
      // Send via Twilio
      const message = await twilioClient.messages.create({
        body: options.body,
        from: this.from,
        to: formattedPhone,
        // Add callback URL for delivery tracking
        statusCallback: process.env.TWILIO_WEBHOOK_URL ? 
          `${process.env.TWILIO_WEBHOOK_URL}/api/webhooks/twilio` : undefined,
      });
      
      console.log('SMS sent successfully:', {
        sid: message.sid,
        to: formattedPhone,
        type: options.type,
        priority
      });
      
      // Update status to SENT
      await this.updateNotificationStatus(notificationId, 'SENT', message.sid);
      
      return {
        success: true,
        notificationId,
        providerId: message.sid
      };
      
    } catch (error: any) {
      console.error('SMS send error:', error);
      
      // Parse Twilio error codes for specific handling
      let errorMessage = 'Failed to send SMS';
      let shouldRetry = true;
      
      if (error.code) {
        switch (error.code) {
          case 21211:
            errorMessage = 'Invalid phone number';
            shouldRetry = false;
            break;
          case 21614:
            errorMessage = 'SMS not supported for this number';
            shouldRetry = false;
            break;
          case 21408:
            errorMessage = 'Account permissions do not allow sending to this number';
            shouldRetry = false;
            break;
          case 20429:
            errorMessage = 'Rate limit exceeded';
            break;
          default:
            errorMessage = error.message || 'Unknown SMS delivery error';
        }
      }
      
      // Update status to FAILED
      await this.updateNotificationStatus(notificationId, 'FAILED', undefined, errorMessage);
      
      // If retriable, schedule retry
      if (shouldRetry && (options.maxRetries || 3) > 0) {
        await this.scheduleRetry(notificationId, options, errorMessage);
      }
      
      return {
        success: false,
        notificationId,
        error: errorMessage
      };
    }
  }

  /**
   * Schedule SMS retry
   */
  private async scheduleRetry(
    notificationId: string,
    originalOptions: EnhancedSMSOptions,
    lastError: string
  ): Promise<void> {
    try {
      const notification = await prisma.notificationEvent.findUnique({
        where: { id: notificationId }
      });
      
      if (!notification || notification.retryCount >= notification.maxRetries) {
        return;
      }
      
      // Calculate exponential backoff: 5min, 15min, 1hour
      const delays = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
      const delay = delays[notification.retryCount] || 60 * 60 * 1000;
      const nextRetryAt = new Date(Date.now() + delay);
      
      // Update notification for retry
      await prisma.notificationEvent.update({
        where: { id: notificationId },
        data: {
          status: 'QUEUED',
          nextRetryAt,
          retryCount: { increment: 1 }
        }
      });
      
      // Log retry attempt
      await prisma.notificationRetry.create({
        data: {
          notificationId,
          attemptNumber: notification.retryCount + 1,
          status: 'QUEUED',
          errorMessage: lastError
        }
      });
      
      console.log('SMS retry scheduled:', {
        notificationId,
        retryCount: notification.retryCount + 1,
        nextRetryAt
      });
      
    } catch (error) {
      console.error('Failed to schedule SMS retry:', error);
    }
  }

  /**
   * Process scheduled retries
   */
  async processRetries(): Promise<void> {
    try {
      const pendingRetries = await prisma.notificationEvent.findMany({
        where: {
          channel: 'SMS',
          status: 'QUEUED',
          nextRetryAt: {
            lte: new Date()
          },
          retryCount: {
            lt: prisma.notificationEvent.fields.maxRetries
          }
        },
        take: 10 // Process max 10 at a time
      });
      
      for (const notification of pendingRetries) {
        if (!notification.recipientPhone) continue;
        
        const retryOptions: EnhancedSMSOptions = {
          to: notification.recipientPhone,
          body: notification.content,
          priority: notification.priority as any,
          type: notification.type,
          userId: notification.recipientId || undefined,
          contextType: notification.contextType || undefined,
          contextId: notification.contextId || undefined,
          maxRetries: notification.maxRetries - notification.retryCount,
          templateId: notification.templateId
        };
        
        // Attempt retry
        const result = await this.sendEnhanced(retryOptions);
        
        // Update retry record
        const latestRetry = await prisma.notificationRetry.findFirst({
          where: { notificationId: notification.id },
          orderBy: { attemptedAt: 'desc' }
        });
        
        if (latestRetry) {
          await prisma.notificationRetry.update({
            where: { id: latestRetry.id },
            data: {
              status: result.success ? 'SENT' : 'FAILED',
              errorMessage: result.error,
              providerId: result.providerId
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to process SMS retries:', error);
    }
  }

  /**
   * High-priority methods for critical child safety notifications
   */
  
  async sendCriticalPickupReminder(
    to: string,
    details: {
      childName: string;
      pickupTime: string;
      location: string;
      parentName: string;
      emergencyContact: string;
    }
  ): Promise<SMSResult> {
    const body = `🚨 URGENT PICKUP REMINDER: ${details.childName} needs pickup at ${details.pickupTime} from ${details.location}. Parent: ${details.parentName}. Emergency: ${details.emergencyContact}. Confirm receipt by replying RECEIVED.`;
    
    return this.sendEnhanced({
      to,
      body,
      priority: 'CRITICAL',
      type: 'PICKUP_REMINDER',
      templateId: 'critical_pickup_reminder',
      maxRetries: 5
    });
  }
  
  async sendEmergencyAlert(
    to: string,
    details: {
      childName: string;
      situation: string;
      location: string;
      contactNumber: string;
    }
  ): Promise<SMSResult> {
    const body = `🚨 EMERGENCY ALERT: ${details.situation} involving ${details.childName} at ${details.location}. Call ${details.contactNumber} IMMEDIATELY. This is an automated emergency notification.`;
    
    return this.sendEnhanced({
      to,
      body,
      priority: 'CRITICAL',
      type: 'EMERGENCY_ALERT',
      templateId: 'emergency_alert',
      maxRetries: 10
    });
  }
  
  async sendDropoffConfirmation(
    to: string,
    details: {
      childName: string;
      dropoffTime: string;
      caregiverName: string;
      location: string;
      photoUrl?: string;
    }
  ): Promise<SMSResult> {
    let body = `✅ DROPOFF CONFIRMED: ${details.childName} safely dropped off with ${details.caregiverName} at ${details.dropoffTime} at ${details.location}.`;
    
    if (details.photoUrl) {
      body += ` Photo: ${details.photoUrl}`;
    }
    
    body += ` Reply STOP to opt out.`;
    
    return this.sendEnhanced({
      to,
      body,
      priority: 'HIGH',
      type: 'DROPOFF_CONFIRMATION',
      templateId: 'dropoff_confirmation'
    });
  }
  
  /**
   * Get SMS delivery statistics
   */
  async getDeliveryStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return prisma.notificationEvent.groupBy({
      by: ['status'],
      _count: { id: true },
      where: {
        channel: 'SMS',
        createdAt: {
          gte: startDate,
          lte: now
        }
      }
    });
  }
}

// Export singleton instance
export const enhancedSmsService = new EnhancedSMSService();