"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import AdminSecurityBanner from './AdminSecurityBanner';

interface AdminUser {
  id: string;
  email: string;
  userType: string;
  profile?: {
    firstName: string;
    lastName: string;
  };
  lastLogin?: string;
  permissions?: {
    canModerateReviews: boolean;
    canManageUsers: boolean;
    canViewFinancials: boolean;
    canAccessLogs: boolean;
    canManageSystem: boolean;
  };
}

interface AdminAuthLayoutProps {
  children: ReactNode;
  requiredPermission?: keyof AdminUser['permissions'];
  title?: string;
  className?: string;
}

const AdminAuthLayout: React.FC<AdminAuthLayoutProps> = ({
  children,
  requiredPermission,
  title,
  className = ""
}) => {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const response = await fetch('/api/admin/session');
      
      if (response.ok) {
        const data = await response.json();
        const user = data.admin;
        
        setAdminUser(user);
        
        // Check required permission
        if (requiredPermission && user.permissions) {
          setHasPermission(user.permissions[requiredPermission] === true);
        } else {
          setHasPermission(true);
        }
      } else if (response.status === 401) {
        // Unauthorized - redirect to admin login
        router.push('/login/admin');
        return;
      } else {
        setError('Failed to verify admin authentication');
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      setError('Authentication check failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login/admin');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout by redirecting anyway
      router.push('/login/admin');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Verifying Admin Access</h2>
          <p className="text-gray-600">Checking authentication and permissions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={checkAdminAuth}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry Authentication
            </button>
            <button
              onClick={() => router.push('/login/admin')}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No admin user (should redirect but show fallback)
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <ShieldExclamationIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600 mb-6">You need to be signed in as an administrator to access this page.</p>
          <button
            onClick={() => router.push('/login/admin')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  // Insufficient permissions
  if (requiredPermission && !hasPermission) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminSecurityBanner adminUser={adminUser} />
        <div className="flex items-center justify-center pt-20">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <ShieldExclamationIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Insufficient Permissions</h2>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this area. 
              Required permission: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{requiredPermission}</code>
            </p>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/admin')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Back to Admin Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Successful authentication - render children
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Security Banner */}
      <AdminSecurityBanner 
        adminUser={adminUser} 
        showSessionTimer={true}
      />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center">
                <div className="relative h-15 w-24">
                  <Image
                    src="/logo.png"
                    fill
                    alt="InstaCares Logo"
                    className="object-contain"
                  />
                </div>
              </Link>
              <div className="h-6 border-l border-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900">{title || 'Admin Panel'}</h1>
            </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-500">
                    Welcome, <span className="font-medium">{adminUser.profile?.firstName} {adminUser.profile?.lastName}</span>
                  </div>
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-700 font-medium text-sm">
                      {adminUser.profile?.firstName?.[0]}{adminUser.profile?.lastName?.[0]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Security Footer */}
      <div className="bg-white border-t border-gray-200 py-2">
        <div className="px-6">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Admin Session ID: {adminUser.id.slice(-8)}</span>
              <span>Last Activity: {new Date().toLocaleTimeString()}</span>
            </div>
            <div>
              InstaCares Admin Console - All actions logged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthLayout;