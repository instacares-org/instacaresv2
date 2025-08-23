// Browser Notifications Utility
import { notificationStorage } from './notification-storage';

export type NotificationType = 'message' | 'booking' | 'payment' | 'system';

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type: NotificationType;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class NotificationService {
  private static instance: NotificationService;
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request permission for browser notifications
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Browser notifications are not supported');
    }

    if (typeof window === 'undefined') {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Check if browser notifications are supported
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Check if notifications are enabled
   */
  public isEnabled(): boolean {
    return this.isSupported() && typeof window !== 'undefined' && Notification.permission === 'granted';
  }

  /**
   * Show a browser notification
   */
  public async showNotification(data: NotificationData): Promise<Notification | null> {
    if (!this.isEnabled()) {
      console.warn('Notifications are not enabled');
      return null;
    }

    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      tag: data.tag || `notification-${Date.now()}`,
      data: {
        type: data.type,
        ...data.data
      },
      requireInteraction: data.type === 'message' || data.type === 'booking',
      actions: data.actions || []
    };

    try {
      const notification = new Notification(data.title, options);

      // Auto-close notification after 5 seconds (except for messages and bookings)
      if (data.type !== 'message' && data.type !== 'booking') {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Show message notification
   */
  public async showMessageNotification(
    senderName: string,
    message: string,
    senderAvatar?: string,
    roomId?: string,
    userId?: string
  ): Promise<Notification | null> {
    // Store notification for dashboard display
    if (userId) {
      notificationStorage.addMessageNotification(userId, senderName, message, roomId);
    }

    return this.showNotification({
      title: `New message from ${senderName}`,
      body: message.length > 100 ? `${message.substring(0, 100)}...` : message,
      icon: senderAvatar || '/logo.png',
      tag: `message-${roomId || Date.now()}`,
      type: 'message',
      data: { roomId, senderName },
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'mark_read', title: 'Mark as Read' }
      ]
    });
  }

  /**
   * Show booking notification
   */
  public async showBookingNotification(
    title: string,
    message: string,
    bookingId?: string,
    actionType?: 'request' | 'confirmation' | 'reminder',
    userId?: string
  ): Promise<Notification | null> {
    // Store notification for dashboard display
    if (userId) {
      notificationStorage.addBookingNotification(userId, title, message, bookingId, actionType);
    }

    const actions = [];
    if (actionType === 'request') {
      actions.push(
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' }
      );
    } else if (actionType === 'confirmation') {
      actions.push({ action: 'view', title: 'View Details' });
    }

    return this.showNotification({
      title,
      body: message,
      icon: '/logo.png',
      tag: `booking-${bookingId || Date.now()}`,
      type: 'booking',
      data: { bookingId, actionType },
      actions
    });
  }

  /**
   * Show payment notification
   */
  public async showPaymentNotification(
    title: string,
    message: string,
    paymentId?: string,
    userId?: string
  ): Promise<Notification | null> {
    // Store notification for dashboard display
    if (userId) {
      notificationStorage.addPaymentNotification(userId, title, message, paymentId);
    }

    return this.showNotification({
      title,
      body: message,
      icon: '/logo.png',
      tag: `payment-${paymentId || Date.now()}`,
      type: 'payment',
      data: { paymentId },
      actions: [{ action: 'view', title: 'View Details' }]
    });
  }

  /**
   * Show system notification
   */
  public async showSystemNotification(
    title: string,
    message: string,
    userId?: string
  ): Promise<Notification | null> {
    // Store notification for dashboard display
    if (userId) {
      notificationStorage.addSystemNotification(userId, title, message);
    }

    return this.showNotification({
      title,
      body: message,
      icon: '/logo.png',
      type: 'system'
    });
  }

  /**
   * Clear all notifications with a specific tag
   */
  public clearNotifications(tag: string): void {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'getNotifications' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications({ tag }).then(notifications => {
          notifications.forEach(notification => notification.close());
        });
      });
    }
  }
}

// Global notification service instance
export const notificationService = NotificationService.getInstance();

// Hook for React components
export function useNotifications(userId?: string) {
  const requestPermission = async () => {
    try {
      const permission = await notificationService.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  // Safely check support and enabled status on client-side only
  const isSupported = typeof window !== 'undefined' ? notificationService.isSupported() : false;
  const isEnabled = typeof window !== 'undefined' ? notificationService.isEnabled() : false;

  const showMessage = (senderName: string, message: string, senderAvatar?: string, roomId?: string) => {
    return notificationService.showMessageNotification(senderName, message, senderAvatar, roomId, userId);
  };

  const showBooking = (title: string, message: string, bookingId?: string, actionType?: 'request' | 'confirmation' | 'reminder') => {
    return notificationService.showBookingNotification(title, message, bookingId, actionType, userId);
  };

  const showPayment = (title: string, message: string, paymentId?: string) => {
    return notificationService.showPaymentNotification(title, message, paymentId, userId);
  };

  const showSystem = (title: string, message: string) => {
    return notificationService.showSystemNotification(title, message, userId);
  };

  return {
    requestPermission,
    isSupported,
    isEnabled,
    showMessage,
    showBooking,
    showPayment,
    showSystem,
    clearNotifications: notificationService.clearNotifications.bind(notificationService)
  };
}