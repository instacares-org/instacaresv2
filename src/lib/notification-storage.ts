"use client";

export interface StoredNotification {
  id: string;
  type: 'booking' | 'caregiver' | 'payment' | 'system' | 'message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  data?: any; // Additional data like roomId, bookingId, etc.
}

export class NotificationStorage {
  private static instance: NotificationStorage;
  private storageKey: string = 'instacares-notifications';
  private listeners: ((notifications: StoredNotification[]) => void)[] = [];

  public static getInstance(): NotificationStorage {
    if (!NotificationStorage.instance) {
      NotificationStorage.instance = new NotificationStorage();
    }
    return NotificationStorage.instance;
  }

  /**
   * Get storage key for a specific user
   */
  private getUserStorageKey(userId: string): string {
    return `${this.storageKey}-${userId}`;
  }

  /**
   * Get all notifications for a user
   */
  public getNotifications(userId: string): StoredNotification[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.getUserStorageKey(userId));
      if (!stored) return [];
      
      const notifications: StoredNotification[] = JSON.parse(stored);
      // Sort by timestamp, newest first
      return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to load notifications:', error);
      return [];
    }
  }

  /**
   * Add a new notification
   */
  public addNotification(userId: string, notification: Omit<StoredNotification, 'id' | 'timestamp'>): StoredNotification {
    if (typeof window === 'undefined') {
      return { ...notification, id: '', timestamp: new Date().toISOString() } as StoredNotification;
    }

    const newNotification: StoredNotification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    const notifications = this.getNotifications(userId);
    notifications.unshift(newNotification);

    // Keep only the last 100 notifications to prevent storage bloat
    const trimmedNotifications = notifications.slice(0, 100);

    try {
      localStorage.setItem(this.getUserStorageKey(userId), JSON.stringify(trimmedNotifications));
      this.notifyListeners(trimmedNotifications);
    } catch (error) {
      console.error('Failed to save notification:', error);
    }

    return newNotification;
  }

  /**
   * Mark a notification as read
   */
  public markAsRead(userId: string, notificationId: string): void {
    if (typeof window === 'undefined') return;

    const notifications = this.getNotifications(userId);
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );

    try {
      localStorage.setItem(this.getUserStorageKey(userId), JSON.stringify(updatedNotifications));
      this.notifyListeners(updatedNotifications);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(userId: string): void {
    if (typeof window === 'undefined') return;

    const notifications = this.getNotifications(userId);
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));

    try {
      localStorage.setItem(this.getUserStorageKey(userId), JSON.stringify(updatedNotifications));
      this.notifyListeners(updatedNotifications);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  public deleteNotification(userId: string, notificationId: string): void {
    if (typeof window === 'undefined') return;

    const notifications = this.getNotifications(userId);
    const filteredNotifications = notifications.filter(notification => notification.id !== notificationId);

    try {
      localStorage.setItem(this.getUserStorageKey(userId), JSON.stringify(filteredNotifications));
      this.notifyListeners(filteredNotifications);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  public clearAllNotifications(userId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.getUserStorageKey(userId), JSON.stringify([]));
      this.notifyListeners([]);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Get unread notification count
   */
  public getUnreadCount(userId: string): number {
    const notifications = this.getNotifications(userId);
    return notifications.filter(notification => !notification.read).length;
  }

  /**
   * Subscribe to notification changes
   */
  public subscribe(callback: (notifications: StoredNotification[]) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(notifications: StoredNotification[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(notifications);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Add a message notification
   */
  public addMessageNotification(userId: string, senderName: string, message: string, roomId?: string): StoredNotification {
    return this.addNotification(userId, {
      type: 'message',
      title: `New message from ${senderName}`,
      message: message.length > 100 ? `${message.substring(0, 100)}...` : message,
      read: false,
      actionUrl: `/parent-dashboard?tab=messages&room=${roomId}`,
      data: { roomId, senderName }
    });
  }

  /**
   * Add a booking notification
   */
  public addBookingNotification(
    userId: string,
    title: string,
    message: string,
    bookingId?: string,
    actionType?: 'request' | 'confirmation' | 'reminder'
  ): StoredNotification {
    return this.addNotification(userId, {
      type: 'booking',
      title,
      message,
      read: false,
      actionUrl: `/parent-dashboard?tab=bookings&booking=${bookingId}`,
      data: { bookingId, actionType }
    });
  }

  /**
   * Add a payment notification
   */
  public addPaymentNotification(userId: string, title: string, message: string, paymentId?: string): StoredNotification {
    return this.addNotification(userId, {
      type: 'payment',
      title,
      message,
      read: false,
      actionUrl: `/parent-dashboard?tab=bookings`,
      data: { paymentId }
    });
  }

  /**
   * Add a system notification
   */
  public addSystemNotification(userId: string, title: string, message: string): StoredNotification {
    return this.addNotification(userId, {
      type: 'system',
      title,
      message,
      read: false
    });
  }
}

// Global instance
export const notificationStorage = NotificationStorage.getInstance();