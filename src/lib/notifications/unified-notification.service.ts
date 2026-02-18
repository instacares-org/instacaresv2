import { prisma } from '@/lib/prisma';
import { emailService } from './email.service';
import { enhancedSmsService, EnhancedSMSOptions, SMSResult } from './enhanced-sms.service';

export interface UnifiedNotificationOptions {
  // Recipient information
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  
  // Notification content
  type: 'BOOKING_REQUEST' | 'BOOKING_CONFIRMATION' | 'BOOKING_CANCELLED' | 'BOOKING_REMINDER' | 
        'PICKUP_REMINDER' | 'DROPOFF_CONFIRMATION' | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' |
        'VERIFICATION_CODE' | 'ACCOUNT_APPROVED' | 'SECURITY_ALERT' | 'EMERGENCY_ALERT' |
        'REVIEW_REQUEST' | 'SYSTEM_MAINTENANCE';
  
  subject?: string; // For emails
  content: string;
  htmlContent?: string; // For emails
  
  // Delivery preferences
  channels: ('EMAIL' | 'SMS')[];
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  
  // Context
  contextType?: string; // 'booking', 'payment', etc.
  contextId?: string;   // Related record ID
  
  // Scheduling
  scheduledAt?: Date;   // When to send (null = immediate)
  
  // Retry configuration
  maxRetries?: number;
  
  // Template information
  templateId: string;
}

export interface NotificationResult {
  success: boolean;
  notificationIds: string[];
  errors: string[];
  partialSuccess?: boolean;
}

export class UnifiedNotificationService {
  
  /**
   * Send notification across multiple channels
   */
  async send(options: UnifiedNotificationOptions): Promise<NotificationResult> {
    const results: NotificationResult = {
      success: true,
      notificationIds: [],
      errors: []
    };
    
    try {
      // Validate required fields
      if (!options.content || !options.type || !options.templateId || !options.channels.length) {
        return {
          success: false,
          notificationIds: [],
          errors: ['Missing required fields: content, type, templateId, or channels']
        };
      }
      
      // Check user preferences if userId provided
      let userPreferences = null;
      if (options.userId) {
        userPreferences = await this.getUserPreferences(options.userId);
      }
      
      // Send via each requested channel
      const sendPromises = options.channels.map(async (channel) => {
        try {
          switch (channel) {
            case 'EMAIL':
              return await this.sendEmail(options, userPreferences);
            case 'SMS':
              return await this.sendSMS(options, userPreferences);
            default:
              throw new Error(`Unsupported channel: ${channel}`);
          }
        } catch (error) {
          console.error(`Failed to send ${channel} notification:`, error);
          results.errors.push(`${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return null;
        }
      });
      
      const channelResults = await Promise.allSettled(sendPromises);
      
      // Process results
      channelResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.success && result.value.notificationId) {
            results.notificationIds.push(result.value.notificationId);
          } else if (!result.value.success) {
            results.errors.push(`${options.channels[index]}: ${result.value.error || 'Unknown error'}`);
          }
        } else if (result.status === 'rejected') {
          results.errors.push(`${options.channels[index]}: ${result.reason}`);
        }
      });
      
      // Determine overall success
      results.success = results.notificationIds.length > 0;
      results.partialSuccess = results.notificationIds.length > 0 && results.errors.length > 0;
      
    } catch (error) {
      console.error('Unified notification send error:', error);
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    return results;
  }
  
  /**
   * Send email notification
   */
  private async sendEmail(
    options: UnifiedNotificationOptions,
    preferences: any
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    
    // Check if email is enabled for user
    if (preferences && !preferences.emailEnabled) {
      return { success: false, error: 'Email notifications disabled for user' };
    }
    
    if (!options.email) {
      return { success: false, error: 'Email address required for EMAIL channel' };
    }
    
    // Log notification event first
    try {
      const notification = await prisma.notificationEvent.create({
        data: {
          type: options.type as any,
          channel: 'EMAIL',
          templateId: options.templateId,
          priority: (options.priority || 'NORMAL') as any,
          recipientId: options.userId,
          recipientEmail: options.email,
          recipientName: options.name,
          subject: options.subject,
          content: options.content,
          htmlContent: options.htmlContent,
          status: 'PENDING',
          scheduledAt: options.scheduledAt,
          retryCount: 0,
          maxRetries: options.maxRetries || 3,
          contextType: options.contextType,
          contextId: options.contextId,
          isTransactional: true,
          triggeredBy: 'unified-service'
        }
      });
      
      // Send via email service
      const emailResult = await emailService.send({
        to: options.email,
        subject: options.subject || `Instacares: ${options.type.replace(/_/g, ' ')}`,
        html: options.htmlContent,
        text: options.content
      });
      
      // Update notification status
      if (emailResult.success) {
        await prisma.notificationEvent.update({
          where: { id: notification.id },
          data: { 
            status: 'SENT',
            sentAt: new Date()
          }
        });
        
        return { success: true, notificationId: notification.id };
      } else {
        await prisma.notificationEvent.update({
          where: { id: notification.id },
          data: { 
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: emailResult.error
          }
        });
        
        return { success: false, notificationId: notification.id, error: emailResult.error };
      }
      
    } catch (error) {
      console.error('Email notification logging error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to log email notification'
      };
    }
  }
  
  /**
   * Send SMS notification
   */
  private async sendSMS(
    options: UnifiedNotificationOptions,
    preferences: any
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    
    // Check if SMS is enabled for user
    if (preferences && !preferences.smsEnabled) {
      return { success: false, error: 'SMS notifications disabled for user' };
    }
    
    if (!options.phone) {
      return { success: false, error: 'Phone number required for SMS channel' };
    }
    
    // Use enhanced SMS service
    const smsOptions: EnhancedSMSOptions = {
      to: options.phone,
      body: options.content,
      priority: options.priority,
      type: options.type,
      userId: options.userId,
      contextType: options.contextType,
      contextId: options.contextId,
      maxRetries: options.maxRetries,
      templateId: options.templateId
    };
    
    const smsResult = await enhancedSmsService.sendEnhanced(smsOptions);
    
    return {
      success: smsResult.success,
      notificationId: smsResult.notificationId,
      error: smsResult.error
    };
  }
  
  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId }
      });
      
      return preferences || {
        emailEnabled: true,
        smsEnabled: true,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true
      };
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      // Return safe defaults
      return {
        emailEnabled: true,
        smsEnabled: true,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true
      };
    }
  }
  
  /**
   * High-level convenience methods for common notifications
   */
  
  async sendBookingConfirmation(
    recipientEmail: string,
    recipientPhone: string,
    booking: {
      id: string;
      caregiverName: string;
      parentName: string;
      date: string;
      time: string;
      duration: number;
      totalAmount: number;
    },
    userId?: string
  ): Promise<NotificationResult> {
    const emailContent = `Your booking with ${booking.caregiverName} on ${booking.date} at ${booking.time} has been confirmed. Total: $${booking.totalAmount}`;
    const smsContent = `Instacares: Booking confirmed with ${booking.caregiverName} on ${booking.date} at ${booking.time}. Total: $${booking.totalAmount}`;
    
    return this.send({
      userId,
      email: recipientEmail,
      phone: recipientPhone,
      name: booking.parentName,
      type: 'BOOKING_CONFIRMATION',
      subject: `Booking Confirmed with ${booking.caregiverName}`,
      content: emailContent,
      channels: ['EMAIL', 'SMS'],
      priority: 'NORMAL',
      contextType: 'booking',
      contextId: booking.id,
      templateId: 'booking_confirmation'
    });
  }
  
  async sendCriticalPickupReminder(
    recipientEmail: string,
    recipientPhone: string,
    details: {
      childName: string;
      pickupTime: string;
      location: string;
      parentName: string;
      emergencyContact: string;
    },
    userId?: string
  ): Promise<NotificationResult> {
    
    // Use enhanced SMS service directly for critical SMS with special handling
    const smsResult = await enhancedSmsService.sendCriticalPickupReminder(recipientPhone, details);
    
    // Send email notification as well
    const emailContent = `URGENT PICKUP REMINDER: ${details.childName} needs pickup at ${details.pickupTime} from ${details.location}. Emergency contact: ${details.emergencyContact}`;
    
    const emailNotification = await this.send({
      userId,
      email: recipientEmail,
      name: details.parentName,
      type: 'PICKUP_REMINDER',
      subject: `🚨 URGENT: Pickup Required - ${details.childName}`,
      content: emailContent,
      channels: ['EMAIL'],
      priority: 'CRITICAL',
      templateId: 'critical_pickup_reminder'
    });
    
    return {
      success: smsResult.success || emailNotification.success,
      notificationIds: [
        ...(smsResult.notificationId ? [smsResult.notificationId] : []),
        ...emailNotification.notificationIds
      ],
      errors: [
        ...(smsResult.error ? [`SMS: ${smsResult.error}`] : []),
        ...emailNotification.errors
      ],
      partialSuccess: smsResult.success !== emailNotification.success
    };
  }
  
  async sendEmergencyAlert(
    recipientEmail: string,
    recipientPhone: string,
    details: {
      childName: string;
      situation: string;
      location: string;
      contactNumber: string;
    },
    userId?: string
  ): Promise<NotificationResult> {
    
    // Use enhanced SMS service for emergency with maximum retries
    const smsResult = await enhancedSmsService.sendEmergencyAlert(recipientPhone, details);
    
    const emailContent = `EMERGENCY ALERT: ${details.situation} involving ${details.childName} at ${details.location}. Call ${details.contactNumber} IMMEDIATELY.`;
    
    const emailNotification = await this.send({
      userId,
      email: recipientEmail,
      type: 'EMERGENCY_ALERT',
      subject: `🚨 EMERGENCY ALERT - ${details.childName}`,
      content: emailContent,
      channels: ['EMAIL'],
      priority: 'CRITICAL',
      templateId: 'emergency_alert'
    });
    
    return {
      success: smsResult.success || emailNotification.success,
      notificationIds: [
        ...(smsResult.notificationId ? [smsResult.notificationId] : []),
        ...emailNotification.notificationIds
      ],
      errors: [
        ...(smsResult.error ? [`SMS: ${smsResult.error}`] : []),
        ...emailNotification.errors
      ],
      partialSuccess: smsResult.success !== emailNotification.success
    };
  }
}

// Export singleton instance
export const unifiedNotificationService = new UnifiedNotificationService();