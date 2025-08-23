"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  EyeIcon,
  UserIcon,
  LockClosedIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

interface AdminSecurityBannerProps {
  adminUser?: {
    id: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
    lastLogin?: string;
  };
  showSessionTimer?: boolean;
  className?: string;
}

interface SessionInfo {
  startTime: number;
  lastActivity: number;
  warningThreshold: number;
  expireTime: number;
}

const AdminSecurityBanner: React.FC<AdminSecurityBannerProps> = ({
  adminUser,
  showSessionTimer = true,
  className = ""
}) => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    startTime: Date.now(),
    lastActivity: Date.now(),
    warningThreshold: 25 * 60 * 1000, // 25 minutes
    expireTime: 30 * 60 * 1000 // 30 minutes
  });
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Update session activity
  const updateActivity = () => {
    setSessionInfo(prev => ({
      ...prev,
      lastActivity: Date.now()
    }));
    setShowWarning(false);
  };

  // Session timer effect
  useEffect(() => {
    if (!showSessionTimer) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - sessionInfo.lastActivity;
      const remaining = sessionInfo.expireTime - elapsed;

      if (remaining <= 0) {
        // Session expired - redirect to login
        window.location.href = '/login/admin';
        return;
      }

      if (remaining <= sessionInfo.warningThreshold && !showWarning) {
        setShowWarning(true);
      }

      // Format remaining time
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionInfo, showSessionTimer, showWarning]);

  // Add activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const throttledUpdate = throttle(updateActivity, 60000); // Update at most once per minute

    events.forEach(event => {
      document.addEventListener(event, throttledUpdate, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledUpdate, true);
      });
    };
  }, []);

  const extendSession = async () => {
    try {
      const response = await fetch('/api/admin/session/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        updateActivity();
        setShowWarning(false);
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  };

  const getClientInfo = () => {
    return {
      browser: navigator.userAgent.split(' ').pop()?.split('/')[0] || 'Unknown',
      platform: navigator.platform || 'Unknown',
      timestamp: new Date().toLocaleString()
    };
  };

  return (
    <div className={`bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-lg ${className}`}>
      {/* Session Warning */}
      {showWarning && (
        <div className="bg-yellow-600 px-4 py-2 text-center">
          <div className="flex items-center justify-center space-x-2 text-sm">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>
              Session expires in {timeRemaining}. 
            </span>
            <button
              onClick={extendSession}
              className="underline hover:no-underline font-medium"
            >
              Extend Session
            </button>
          </div>
        </div>
      )}

      {/* Main Security Banner */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Admin info */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <ShieldCheckIcon className="h-5 w-5 text-green-300" />
              <span className="text-sm font-medium">Admin Session Active</span>
            </div>
            
            {adminUser && (
              <div className="flex items-center space-x-2 text-sm">
                <UserIcon className="h-4 w-4 opacity-75" />
                <span>
                  {adminUser.profile?.firstName} {adminUser.profile?.lastName}
                </span>
                <span className="opacity-75">({adminUser.email})</span>
              </div>
            )}
          </div>

          {/* Right side - Session info */}
          <div className="flex items-center space-x-4 text-sm">
            {showSessionTimer && (
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 opacity-75" />
                <span className="font-mono">{timeRemaining}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2 opacity-75">
              <ComputerDesktopIcon className="h-4 w-4" />
              <span>{getClientInfo().browser}</span>
            </div>

            {adminUser?.lastLogin && (
              <div className="flex items-center space-x-2 opacity-75">
                <LockClosedIcon className="h-4 w-4" />
                <span>
                  Last: {new Date(adminUser.lastLogin).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Security notices */}
        <div className="mt-2 flex items-center justify-between text-xs opacity-90">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <EyeIcon className="h-3 w-3" />
              <span>All actions are logged and monitored</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <span>Secure connection established</span>
            <div className="h-2 w-2 bg-green-300 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility function to throttle updates
function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  let lastExecTime = 0;
  
  return (...args: Parameters<T>) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

export default AdminSecurityBanner;