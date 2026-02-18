"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from '../lib/notifications';

interface NotificationSettings {
  messages: boolean;
  bookings: boolean;
  payments: boolean;
  system: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  requestPermission: () => Promise<boolean>;
  isSupported: boolean;
  isEnabled: boolean;
  permissionStatus: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const notifications = useNotifications(user?.id);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  
  // Default notification settings
  const [settings, setSettings] = useState<NotificationSettings>({
    messages: true,
    bookings: true,
    payments: true,
    system: true
  });

  // Load saved settings from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const savedSettings = localStorage.getItem(`notification-settings-${user.id}`);
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch (error) {
          console.error('Failed to load notification settings:', error);
        }
      }
    }
  }, [user]);

  // Check initial permission status (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && notifications.isSupported) {
      setPermissionStatus(Notification.permission);
    }
  }, [notifications.isSupported]);

  // Save settings to localStorage when they change (client-side only)
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(`notification-settings-${user.id}`, JSON.stringify(updatedSettings));
    }
  };

  // Request notification permission (client-side only)
  const requestPermission = async (): Promise<boolean> => {
    try {
      const granted = await notifications.requestPermission();
      if (typeof window !== 'undefined') {
        setPermissionStatus(Notification.permission);
      }
      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  const contextValue: NotificationContextType = {
    settings,
    updateSettings,
    requestPermission,
    isSupported: notifications.isSupported,
    isEnabled: notifications.isEnabled,
    permissionStatus
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};