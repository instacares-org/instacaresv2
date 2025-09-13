"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  EyeIcon, 
  EyeSlashIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface LoginAttempt {
  timestamp: number;
  success: boolean;
  ip?: string;
}

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  
  // Refs for auto-focus
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);

  // Constants
  const MAX_LOGIN_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const TOTP_ENABLED = false; // Toggle for TOTP feature

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user.userType === 'ADMIN') {
            setSessionInfo(data.user);
            setSuccessMessage('Already authenticated. Redirecting...');
            setTimeout(() => router.push('/admin'), 1500);
          }
        }
      } catch (error) {
        // User is not logged in, continue with login page
      }
    };

    checkAuth();
    loadLoginAttempts();
    checkLockoutStatus();
  }, [router]);

  // Load previous login attempts from localStorage
  const loadLoginAttempts = () => {
    try {
      const attempts = localStorage.getItem('admin_login_attempts');
      if (attempts) {
        const parsedAttempts = JSON.parse(attempts);
        setLoginAttempts(parsedAttempts);
      }
    } catch (error) {
      console.warn('Could not load login attempts');
    }
  };

  // Save login attempt to localStorage
  const saveLoginAttempt = (success: boolean) => {
    const attempt: LoginAttempt = {
      timestamp: Date.now(),
      success,
    };
    
    const updatedAttempts = [...loginAttempts, attempt].slice(-10); // Keep last 10 attempts
    setLoginAttempts(updatedAttempts);
    
    try {
      localStorage.setItem('admin_login_attempts', JSON.stringify(updatedAttempts));
    } catch (error) {
      console.warn('Could not save login attempt');
    }
  };

  // Check lockout status
  const checkLockoutStatus = () => {
    const now = Date.now();
    const recentFailedAttempts = loginAttempts.filter(
      attempt => !attempt.success && (now - attempt.timestamp) < LOCKOUT_DURATION
    );

    if (recentFailedAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const oldestFailedAttempt = recentFailedAttempts[0];
      const unlockTime = oldestFailedAttempt.timestamp + LOCKOUT_DURATION;
      
      if (now < unlockTime) {
        setIsLocked(true);
        setLockoutTime(unlockTime);
        
        // Set up countdown timer
        const interval = setInterval(() => {
          const remaining = unlockTime - Date.now();
          if (remaining <= 0) {
            setIsLocked(false);
            setLockoutTime(0);
            clearInterval(interval);
          }
        }, 1000);
        
        return () => clearInterval(interval);
      }
    }
  };

  // Format lockout time remaining
  const formatLockoutTime = () => {
    if (!isLocked || !lockoutTime) return '';
    const remaining = Math.max(0, lockoutTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(''); // Clear error when user starts typing
    setSuccessMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      setError(`Account is locked. Please wait ${formatLockoutTime()}`);
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Import signIn from next-auth/react dynamically
      const { signIn } = await import('next-auth/react');

      // Use NextAuth signIn with credentials provider
      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
        userType: 'admin',
      });

      if (result?.ok) {
        // Login successful
        saveLoginAttempt(true);
        setSuccessMessage('Authentication successful! Redirecting to admin dashboard...');

        // Simulate TOTP check if enabled (for demo purposes)
        if (TOTP_ENABLED && !requiresTOTP && !formData.totpCode) {
          setRequiresTOTP(true);
          setSuccessMessage('Please enter your 2FA code to complete login');
          setTimeout(() => totpRef.current?.focus(), 100);
          return;
        }

        // Redirect after short delay to show success message
        setTimeout(() => {
          router.push('/admin');
        }, 1500);

      } else {
        // Login failed
        saveLoginAttempt(false);
        setError(result?.error || 'Authentication failed');
        checkLockoutStatus();
      }
    } catch (error) {
      saveLoginAttempt(false);
      setError('Network error occurred. Please try again.');
      checkLockoutStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const getRecentAttempts = () => {
    const now = Date.now();
    return loginAttempts.filter(
      attempt => (now - attempt.timestamp) < 24 * 60 * 60 * 1000 // Last 24 hours
    );
  };

  if (sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <ShieldCheckIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Authenticated</h2>
          <p className="text-gray-600 mb-4">Welcome back, {sessionInfo.profile?.firstName}</p>
          <p className="text-green-600 font-medium">{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Admin Authentication
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Secure access to InstaCares Admin Dashboard
          </p>
        </div>

        {/* Security Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <LockClosedIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Enhanced Security</h3>
              <p className="text-xs text-blue-600 mt-1">
                This page uses encrypted authentication and monitors login attempts for security.
              </p>
            </div>
          </div>
        </div>

        {/* Lockout Warning */}
        {isLocked && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Account Temporarily Locked</h3>
                <p className="text-xs text-red-600 mt-1">
                  Too many failed attempts. Unlock in: {formatLockoutTime()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <ShieldCheckIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                <UserIcon className="inline h-4 w-4 mr-1" />
                Admin Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isLocked}
                value={formData.email}
                onChange={handleInputChange}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                placeholder="admin@instacares.com"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                <LockClosedIcon className="inline h-4 w-4 mr-1" />
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLocked}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  placeholder="Enter your secure password"
                />
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* 2FA Code Field (shown when required) */}
            {requiresTOTP && (
              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-2">
                  <DevicePhoneMobileIcon className="inline h-4 w-4 mr-1" />
                  Two-Factor Authentication Code
                </label>
                <input
                  ref={totpRef}
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required={requiresTOTP}
                  disabled={isLocked}
                  value={formData.totpCode}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-center text-lg font-mono tracking-widest"
                  placeholder="000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                disabled={isLocked}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:cursor-not-allowed"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                Remember me for 30 days
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  {requiresTOTP ? 'Verifying 2FA...' : 'Authenticating...'}
                </div>
              ) : isLocked ? (
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2" />
                  Locked ({formatLockoutTime()})
                </div>
              ) : (
                <div className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 mr-2" />
                  {requiresTOTP ? 'Complete Authentication' : 'Sign in to Admin Dashboard'}
                </div>
              )}
            </button>
          </div>

          {/* Login Attempts Info */}
          {getRecentAttempts().length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Recent login activity:</span>
                  <span>{getRecentAttempts().length} attempts (24h)</span>
                </div>
                <div className="mt-1">
                  Last successful: {
                    getRecentAttempts().find(a => a.success)
                      ? new Date(getRecentAttempts().filter(a => a.success).pop()!.timestamp).toLocaleString()
                      : 'None'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              Not an admin? Go to{' '}
              <a href="/login/parent" className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
                Parent Login
              </a>
              {' '}or{' '}
              <a href="/login/caregiver" className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
                Caregiver Login
              </a>
            </p>
            <p className="text-xs text-gray-400">
              Having trouble? Contact system administrator
            </p>
          </div>
        </form>

        {/* Security Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
            <KeyIcon className="h-3 w-3" />
            <span>Secured with enterprise-grade encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
}