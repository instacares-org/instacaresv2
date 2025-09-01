import { emailService } from './email.service';
import { smsService } from './sms.service';
import { prisma } from '@/lib/database';

export type NotificationType = 
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'new_message'
  | 'payment_received'
  | 'payment_pending'
  | 'review_requested'
  | 'account_approved'
  | 'account_suspended';

export interface NotificationData {
  userId: string;
  type: NotificationType;
  data: Record<string, any>;
  channels?: ('email' | 'sms' | 'push')[];
}

export class NotificationService {
  /**
   * Send notification through multiple channels
   */
  async send(notification: NotificationData): Promise<void> {
    try {
      // Get user preferences
      const user = await prisma.user.findUnique({
        where: { id: notification.userId },
        include: {
          profile: true,
          notificationPreferences: true,
        },
      });

      if (!user) {
        console.error('User not found for notification:', notification.userId);
        return;
      }

      // Determine which channels to use
      const channels = notification.channels || this.getChannelsForType(notification.type, user.notificationPreferences);

      // Send through each channel
      const promises = [];

      if (channels.includes('email') && user.email) {
        promises.push(this.sendEmail(user, notification));
      }

      if (channels.includes('sms') && user.profile?.phone) {
        promises.push(this.sendSMS(user, notification));
      }

      if (channels.includes('push')) {
        promises.push(this.sendPushNotification(user, notification));
      }

      // Log notification
      promises.push(this.logNotification(notification));

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Notification service error:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(user: any, notification: NotificationData): Promise<void> {
    switch (notification.type) {
      case 'booking_confirmed':
        await emailService.sendBookingConfirmation(
          user.email,
          notification.data as any
        );
        break;
      
      case 'booking_cancelled':
        await emailService.sendCancellationNotice(
          user.email,
          notification.data as any
        );
        break;
      
      // Add more cases as needed
      default:
        console.log('Email template not implemented for:', notification.type);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(user: any, notification: NotificationData): Promise<void> {
    const phone = user.profile?.phone;
    if (!phone) return;

    switch (notification.type) {
      case 'booking_confirmed':
        await smsService.sendBookingConfirmationSMS(
          phone,
          notification.data as any
        );
        break;
      
      case 'booking_cancelled':
        await smsService.sendCancellationSMS(
          phone,
          notification.data as any
        );
        break;
      
      // Add more cases as needed
      default:
        console.log('SMS template not implemented for:', notification.type);
    }
  }

  /**
   * Send push notification (placeholder for future implementation)
   */
  private async sendPushNotification(user: any, notification: NotificationData): Promise<void> {
    // TODO: Implement push notifications using Firebase or OneSignal
    console.log('Push notification would be sent:', { user: user.id, notification });
  }

  /**
   * Log notification in database
   */
  private async logNotification(notification: NotificationData): Promise<void> {
    try {
      await prisma.notificationLog.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          data: notification.data,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  /**
   * Determine channels based on notification type and user preferences
   */
  private getChannelsForType(type: NotificationType, preferences: any): ('email' | 'sms' | 'push')[] {
    // Default channels by notification type
    const defaultChannels: Record<NotificationType, ('email' | 'sms' | 'push')[]> = {
      booking_confirmed: ['email', 'sms'],
      booking_cancelled: ['email', 'sms'],
      booking_reminder: ['email', 'sms'],
      new_message: ['email', 'push'],
      payment_received: ['email'],
      payment_pending: ['email'],
      review_requested: ['email'],
      account_approved: ['email'],
      account_suspended: ['email', 'sms'],
    };

    // Override with user preferences if available
    if (preferences) {
      const channels: ('email' | 'sms' | 'push')[] = [];
      if (preferences.email) channels.push('email');
      if (preferences.sms) channels.push('sms');
      if (preferences.push) channels.push('push');
      return channels.length > 0 ? channels : defaultChannels[type];
    }

    return defaultChannels[type];
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(notifications: NotificationData[]): Promise<void> {
    // Process in batches to avoid overwhelming the services
    const batchSize = 10;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(n => this.send(n)));
      
      // Small delay between batches
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();