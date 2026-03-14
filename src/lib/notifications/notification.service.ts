import { emailService } from './email.service';
import { smsService } from './sms.service';
import { prisma } from '@/lib/db';
import { createInvoiceData, generateInvoiceHTML } from './invoice.service';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'new_booking_caregiver'
  | 'new_message'
  | 'payment_received'
  | 'payment_pending'
  | 'review_requested'
  | 'account_approved'
  | 'account_rejected'
  | 'account_suspended'
  | 'supervisor_welcome';

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
    let result: { success: boolean; error?: string } = { success: false };

    try {
      switch (notification.type) {
        case 'booking_confirmed':
          // Generate parent invoice HTML for attachment
          let parentInvoiceHtml: string | undefined;
          try {
            const bookingData = notification.data;
            // Convert amounts from dollars to cents if they're in dollars
            const totalAmountCents = typeof bookingData.totalAmount === 'string'
              ? Math.round(parseFloat(bookingData.totalAmount) * 100)
              : (bookingData.totalAmount > 1000 ? bookingData.totalAmount : bookingData.totalAmount * 100);

            // Calculate platform fee (approximately 16% of total)
            const platformFeeCents = Math.round(totalAmountCents * 0.16);

            const invoiceData = createInvoiceData('parent', {
              id: bookingData.id || 'N/A',
              parentName: bookingData.parentName || 'Parent',
              caregiverName: bookingData.caregiverName || 'Caregiver',
              date: bookingData.date || new Date().toLocaleDateString(),
              startTime: bookingData.startTime || bookingData.time || '',
              endTime: bookingData.endTime || '',
              duration: typeof bookingData.duration === 'number' ? bookingData.duration : parseFloat(bookingData.duration) || 0,
              childrenCount: bookingData.childrenCount || 1,
              totalAmount: totalAmountCents,
              platformFee: platformFeeCents,
            });
            parentInvoiceHtml = generateInvoiceHTML(invoiceData);
          } catch (invoiceError) {
            console.error('Error generating parent invoice:', invoiceError);
            // Continue without invoice attachment
          }

          result = await emailService.sendBookingConfirmation(
            user.email,
            notification.data as any,
            parentInvoiceHtml
          );
          break;

        case 'new_booking_caregiver':
          // Generate caregiver invoice/payout statement HTML for attachment
          let caregiverInvoiceHtml: string | undefined;
          try {
            const bookingData = notification.data;
            // Convert amounts from dollars to cents if they're in dollars
            const totalAmountCents = typeof bookingData.totalAmount === 'string'
              ? Math.round(parseFloat(bookingData.totalAmount) * 100)
              : (bookingData.totalAmount > 1000 ? bookingData.totalAmount : bookingData.totalAmount * 100);

            // Calculate platform fee (approximately 16% of total)
            const platformFeeCents = Math.round(totalAmountCents * 0.16);

            const invoiceData = createInvoiceData('caregiver', {
              id: bookingData.id || 'N/A',
              parentName: bookingData.parentName || 'Parent',
              caregiverName: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'Caregiver',
              date: bookingData.date || new Date().toLocaleDateString(),
              startTime: bookingData.startTime || bookingData.time || '',
              endTime: bookingData.endTime || '',
              duration: typeof bookingData.duration === 'number' ? bookingData.duration : parseFloat(bookingData.duration) || 0,
              childrenCount: bookingData.childrenCount || 1,
              totalAmount: totalAmountCents,
              platformFee: platformFeeCents,
            });
            caregiverInvoiceHtml = generateInvoiceHTML(invoiceData);
          } catch (invoiceError) {
            console.error('Error generating caregiver invoice:', invoiceError);
            // Continue without invoice attachment
          }

          result = await emailService.sendNewBookingToCaregiver(
            user.email,
            notification.data as any,
            caregiverInvoiceHtml
          );
          break;

        case 'booking_cancelled':
          result = await emailService.sendCancellationNotice(
            user.email,
            notification.data as any
          );
          break;

        case 'account_approved':
          result = await emailService.sendAccountApprovalEmail(
            user.email,
            notification.data as any
          );
          break;

        case 'account_rejected':
          result = await emailService.sendAccountRejectionEmail(
            user.email,
            notification.data as any
          );
          break;

        case 'supervisor_welcome':
          result = await emailService.sendSupervisorWelcomeEmail(
            user.email,
            notification.data as any
          );
          break;

        default:
          console.log('Email template not implemented for:', notification.type);
          return;
      }

      // Log to notificationEvent for admin visibility
      await this.logNotificationEvent(
        notification,
        user,
        'EMAIL',
        result.success ? 'SENT' : 'FAILED',
        result.error
      );
    } catch (error) {
      console.error('Email send error:', error);
      await this.logNotificationEvent(
        notification,
        user,
        'EMAIL',
        'FAILED',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(user: any, notification: NotificationData): Promise<void> {
    const phone = user.profile?.phone;
    if (!phone) return;

    let result: { success: boolean; error?: string } = { success: false };

    try {
      switch (notification.type) {
        case 'booking_confirmed':
          result = await smsService.sendBookingConfirmationSMS(
            phone,
            notification.data as any
          );
          break;

        case 'new_booking_caregiver':
          // Send SMS notification for new booking to caregiver
          result = await smsService.send({
            to: phone,
            body: `InstaCares: New booking from ${notification.data.parentName} on ${notification.data.date}. Check your dashboard for details.`,
          });
          break;

        case 'booking_cancelled':
          result = await smsService.sendCancellationSMS(
            phone,
            notification.data as any
          );
          break;

        // Add more cases as needed
        default:
          console.log('SMS template not implemented for:', notification.type);
          return;
      }

      // Log to notificationEvent for admin visibility
      await this.logNotificationEvent(
        notification,
        user,
        'SMS',
        result.success ? 'SENT' : 'FAILED',
        result.error
      );
    } catch (error) {
      console.error('SMS send error:', error);
      await this.logNotificationEvent(
        notification,
        user,
        'SMS',
        'FAILED',
        error instanceof Error ? error.message : 'Unknown error'
      );
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
   * Log notification in database (both notificationLog and notificationEvent for admin visibility)
   */
  private async logNotification(notification: NotificationData, user?: any, channel?: string): Promise<void> {
    try {
      const { title, message } = this.formatNotificationForDisplay(notification.type, notification.data);

      await prisma.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          title,
          message,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  /**
   * Generate human-readable title and message for in-app notification display
   */
  private formatNotificationForDisplay(type: NotificationType, data: Record<string, any>): { title: string; message: string } {
    switch (type) {
      case 'booking_confirmed':
        return {
          title: 'Booking Confirmed',
          message: `Your booking with ${data.caregiverName || 'your caregiver'} on ${data.date || ''} from ${data.startTime || data.time || ''} to ${data.endTime || ''} has been confirmed. Total: $${data.totalAmount || ''}`,
        };

      case 'new_booking_caregiver':
        return {
          title: 'New Booking Request',
          message: `${data.parentName || 'A parent'} has booked you on ${data.date || ''} from ${data.startTime || data.time || ''} to ${data.endTime || ''} for ${data.childrenCount || 1} child${(data.childrenCount || 1) > 1 ? 'ren' : ''}. Earnings: $${data.totalAmount || ''}`,
        };

      case 'booking_cancelled':
        return {
          title: 'Booking Cancelled',
          message: `A booking on ${data.date || ''} has been cancelled.${data.reason ? ` Reason: ${data.reason}` : ''}`,
        };

      case 'booking_reminder':
        return {
          title: 'Upcoming Booking Reminder',
          message: `You have a booking ${data.date ? `on ${data.date}` : 'coming up'} at ${data.startTime || data.time || ''}. Don't forget!`,
        };

      case 'payment_received':
        return {
          title: 'Payment Received',
          message: `You received a payment of $${data.amount || data.totalAmount || '0'}${data.date ? ` for your booking on ${data.date}` : ''}.`,
        };

      case 'payment_pending':
        return {
          title: 'Payment Pending',
          message: `A payment of $${data.amount || data.totalAmount || '0'} is being processed.`,
        };

      case 'review_requested':
        return {
          title: 'Leave a Review',
          message: `How was your experience${data.caregiverName ? ` with ${data.caregiverName}` : ''}? Please leave a review.`,
        };

      case 'account_approved':
        return {
          title: 'Account Approved',
          message: 'Your account has been approved! You can now start accepting bookings.',
        };

      case 'account_rejected':
        return {
          title: 'Account Not Approved',
          message: `Your account application was not approved.${data.reason ? ` Reason: ${data.reason}` : ' Please contact support for more information.'}`,
        };

      case 'account_suspended':
        return {
          title: 'Account Suspended',
          message: `Your account has been suspended.${data.reason ? ` Reason: ${data.reason}` : ' Please contact support.'}`,
        };

      case 'new_message':
        return {
          title: 'New Message',
          message: `You have a new message${data.senderName ? ` from ${data.senderName}` : ''}.`,
        };

      case 'supervisor_welcome':
        return {
          title: 'Welcome to InstaCares',
          message: 'Your supervisor account has been created. Please log in and change your password.',
        };

      default:
        return {
          title: 'Notification',
          message: data.message || 'You have a new notification.',
        };
    }
  }

  /**
   * Log notification to notificationEvent for admin dashboard visibility
   */
  private async logNotificationEvent(
    notification: NotificationData,
    user: any,
    channel: 'EMAIL' | 'SMS',
    status: 'SENT' | 'FAILED',
    error?: string
  ): Promise<void> {
    try {
      // Map notification type to event type
      const typeMapping: Record<NotificationType, string> = {
        booking_confirmed: 'BOOKING_CONFIRMATION',
        booking_cancelled: 'BOOKING_CANCELLED',
        booking_reminder: 'BOOKING_REMINDER',
        new_booking_caregiver: 'BOOKING_REQUEST',
        new_message: 'SYSTEM_MAINTENANCE',
        payment_received: 'PAYMENT_RECEIVED',
        payment_pending: 'PAYMENT_FAILED',
        review_requested: 'REVIEW_REQUEST',
        account_approved: 'ACCOUNT_APPROVED',
        account_rejected: 'ACCOUNT_APPROVED',
        account_suspended: 'SECURITY_ALERT',
        supervisor_welcome: 'ACCOUNT_APPROVED',
      };

      const eventType = typeMapping[notification.type] || 'SYSTEM_MAINTENANCE';

      await prisma.notificationEvent.create({
        data: {
          type: eventType as any,
          channel,
          templateId: notification.type,
          priority: 'NORMAL',
          recipientId: notification.userId,
          recipientEmail: channel === 'EMAIL' ? user?.email : undefined,
          recipientPhone: channel === 'SMS' ? user?.profile?.phone : undefined,
          recipientName: user?.name || `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim(),
          subject: this.getSubjectForType(notification.type, notification.data),
          content: JSON.stringify(notification.data),
          status,
          sentAt: status === 'SENT' ? new Date() : undefined,
          failedAt: status === 'FAILED' ? new Date() : undefined,
          errorMessage: error,
          retryCount: 0,
          maxRetries: 3,
          contextType: notification.data.id ? 'booking' : undefined,
          contextId: notification.data.id,
          isTransactional: true,
          triggeredBy: 'notification-service',
        },
      });
    } catch (err) {
      console.error('Failed to log notification event:', err);
    }
  }

  /**
   * Get email subject based on notification type
   */
  private getSubjectForType(type: NotificationType, data: Record<string, any>): string {
    switch (type) {
      case 'booking_confirmed':
        return `Booking Confirmed with ${data.caregiverName || 'your caregiver'}`;
      case 'new_booking_caregiver':
        return `New Booking from ${data.parentName || 'a parent'} - ${data.date || ''}`;
      case 'booking_cancelled':
        return `Booking Cancelled - ${data.bookingId || ''}`;
      case 'booking_reminder':
        return `Upcoming Booking Reminder`;
      case 'payment_received':
        return `Payment Received - $${data.amount || ''}`;
      case 'account_approved':
        return `Your Account Has Been Approved`;
      default:
        return `InstaCares Notification`;
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
      new_booking_caregiver: ['email', 'sms'],
      new_message: ['email', 'push'],
      payment_received: ['email'],
      payment_pending: ['email'],
      review_requested: ['email'],
      account_approved: ['email'],
      account_rejected: ['email'],
      account_suspended: ['email', 'sms'],
      supervisor_welcome: ['email'],
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