"use client";

import { useState, useEffect } from 'react';
import { notificationStorage, StoredNotification } from '../lib/notification-storage';
import { useAuth } from '../contexts/AuthContext';
import { addCSRFHeader } from '../lib/csrf';

export function useNotificationStorage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch notifications from database API
  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.notifications);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Fallback to localStorage notifications
      const userNotifications = notificationStorage.getNotifications(user.id);
      setNotifications(userNotifications);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Refresh notifications every 30 seconds to catch new ones
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  const addNotification = (notification: Omit<StoredNotification, 'id' | 'timestamp'>) => {
    if (!user) return null;
    return notificationStorage.addNotification(user.id, notification);
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const baseHeaders: HeadersInit = { 'Content-Type': 'application/json' };
      const headers = addCSRFHeader(baseHeaders);

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ notificationId }),
      });
      
      if (response.ok) {
        // Update local state immediately for better UX
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        ));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const baseHeaders: HeadersInit = { 'Content-Type': 'application/json' };
      const headers = addCSRFHeader(baseHeaders);

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ markAllAsRead: true }),
      });
      
      if (response.ok) {
        // Update local state immediately for better UX
        setNotifications(prev => prev.map(n => ({ 
          ...n, 
          isRead: true, 
          readAt: new Date().toISOString() 
        })));
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = (notificationId: string) => {
    if (!user) return;
    notificationStorage.deleteNotification(user.id, notificationId);
  };

  const clearAll = async () => {
    if (!user) return;

    try {
      const headers = addCSRFHeader({});

      const response = await fetch('/api/notifications?deleteAll=true', {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        // Clear local state immediately
        setNotifications([]);
        // Also clear localStorage
        notificationStorage.clearAllNotifications(user.id);
      }
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const addMessageNotification = (senderName: string, message: string, roomId?: string) => {
    if (!user) return null;
    return notificationStorage.addMessageNotification(user.id, senderName, message, roomId);
  };

  const addBookingNotification = (title: string, message: string, bookingId?: string, actionType?: 'request' | 'confirmation' | 'reminder') => {
    if (!user) return null;
    return notificationStorage.addBookingNotification(user.id, title, message, bookingId, actionType);
  };

  const addPaymentNotification = (title: string, message: string, paymentId?: string) => {
    if (!user) return null;
    return notificationStorage.addPaymentNotification(user.id, title, message, paymentId);
  };

  const addSystemNotification = (title: string, message: string) => {
    if (!user) return null;
    return notificationStorage.addSystemNotification(user.id, title, message);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  // Unread count calculation completed

  return {
    notifications,
    loading,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addMessageNotification,
    addBookingNotification,
    addPaymentNotification,
    addSystemNotification,
    refreshNotifications: fetchNotifications
  };
}