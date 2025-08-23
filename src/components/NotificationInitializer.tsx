"use client";

import React, { useEffect, useState } from 'react';
import { BellIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useNotificationContext } from '../contexts/NotificationContext';
import { setupNotificationClickHandlers } from '../lib/notification-handlers';

const NotificationInitializer: React.FC = () => {
  const { requestPermission, isSupported, permissionStatus } = useNotificationContext();
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  useEffect(() => {
    // Setup notification click handlers (client-side only)
    if (typeof window !== 'undefined') {
      setupNotificationClickHandlers();
    }

    // Check if we should show the permission prompt (client-side only)
    if (typeof window !== 'undefined') {
      const hasAskedBefore = localStorage.getItem('notification-permission-asked');
      
      if (isSupported && permissionStatus === 'default' && !hasAskedBefore && !hasAsked) {
        // Show prompt after a short delay to let the page load
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isSupported, permissionStatus, hasAsked]);

  const handleEnableNotifications = async () => {
    setHasAsked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification-permission-asked', 'true');
    }
    
    const granted = await requestPermission();
    if (granted) {
      setShowPrompt(false);
      
      // Show a welcome notification (client-side only)
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          new Notification('Notifications Enabled! 🎉', {
            body: 'You\'ll now receive real-time updates from Instacares',
            icon: '/logo.png'
          });
        }, 500);
      }
    } else {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setHasAsked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification-permission-asked', 'true');
    }
    setShowPrompt(false);
  };

  if (!showPrompt || !isSupported || permissionStatus !== 'default') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <BellIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              Enable Notifications
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Get instant alerts for messages, bookings, and important updates
            </p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleEnableNotifications}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Enable
              </button>
              <button
                onClick={handleDismiss}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Maybe Later
              </button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="inline-flex text-gray-400 hover:text-gray-500"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationInitializer;