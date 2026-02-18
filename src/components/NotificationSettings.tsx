"use client";

import React from 'react';
import { 
  BellIcon, 
  BellSlashIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useNotificationContext } from '../contexts/NotificationContext';

const NotificationSettings: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    requestPermission, 
    isSupported, 
    isEnabled,
    permissionStatus 
  } = useNotificationContext();

  const handlePermissionRequest = async () => {
    const granted = await requestPermission();
    if (granted) {
      // Optionally show a test notification
      if ('Notification' in window) {
        new Notification('Notifications Enabled!', {
          body: 'You will now receive real-time notifications from Instacares',
          icon: '/logo.png'
        });
      }
    }
  };

  const getPermissionStatusDisplay = () => {
    if (!isSupported) {
      return (
        <div className="flex items-center text-gray-500 dark:text-gray-400">
          <XCircleIcon className="h-5 w-5 mr-2" />
          Not supported in this browser
        </div>
      );
    }

    switch (permissionStatus) {
      case 'granted':
        return (
          <div className="flex items-center text-green-600 dark:text-green-400">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            Notifications enabled
          </div>
        );
      case 'denied':
        return (
          <div className="flex items-center text-red-600 dark:text-red-400">
            <XCircleIcon className="h-5 w-5 mr-2" />
            Notifications blocked
          </div>
        );
      default:
        return (
          <div className="flex items-center text-yellow-600 dark:text-yellow-400">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            Permission not requested
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <BellIcon className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
        Notification Settings
      </h3>

      {/* Permission Status */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Browser Notifications</h4>
        <div className="flex items-center justify-between">
          <div>
            {getPermissionStatusDisplay()}
            {permissionStatus === 'denied' && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Please enable notifications in your browser settings to receive updates.
              </p>
            )}
          </div>
          {permissionStatus === 'default' && (
            <button
              onClick={handlePermissionRequest}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      {isEnabled && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Notification Preferences</h4>
          
          {/* Messages */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-3" />
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">New Messages</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">Get notified when you receive new chat messages</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.messages}
                onChange={(e) => updateSettings({ messages: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Bookings */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 text-green-500 dark:text-green-400 mr-3" />
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">Booking Updates</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">Get notified about booking requests and confirmations</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.bookings}
                onChange={(e) => updateSettings({ bookings: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 dark:peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* Payments */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center">
              <CreditCardIcon className="h-5 w-5 text-purple-500 dark:text-purple-400 mr-3" />
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">Payment Updates</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">Get notified about payment confirmations and receipts</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.payments}
                onChange={(e) => updateSettings({ payments: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 dark:peer-checked:bg-purple-500"></div>
            </label>
          </div>

          {/* System */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 dark:text-orange-400 mr-3" />
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">System Updates</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">Get notified about important system announcements</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.system}
                onChange={(e) => updateSettings({ system: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 dark:peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>
      )}

      {/* Test Notification Button */}
      {isEnabled && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={() => {
              new Notification('Test Notification', {
                body: 'This is a test notification from Instacares!',
                icon: '/logo.png'
              });
            }}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
          >
            Test Notification
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;