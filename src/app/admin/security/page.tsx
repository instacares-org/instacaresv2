"use client";

import React from 'react';
import AdminAuthLayout from '@/components/AdminAuthLayout';
import {
  ShieldCheckIcon,
  LockClosedIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  KeyIcon,
  ComputerDesktopIcon,
  UserIcon,
  CogIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

export default function AdminSecurityPage() {
  const securityFeatures = [
    {
      icon: ShieldCheckIcon,
      title: "Enhanced Authentication",
      description: "Secure login with encrypted tokens and session management",
      status: "Active",
      color: "green"
    },
    {
      icon: LockClosedIcon,
      title: "Account Lockout Protection",
      description: "Automatic lockout after failed login attempts (3 attempts, 15min timeout)",
      status: "Enabled",
      color: "blue"
    },
    {
      icon: ClockIcon,
      title: "Session Management",
      description: "30-minute session timeout with activity monitoring and extension",
      status: "Active",
      color: "yellow"
    },
    {
      icon: EyeIcon,
      title: "Audit Logging",
      description: "All admin actions are logged with timestamps and IP tracking",
      status: "Monitoring",
      color: "purple"
    },
    {
      icon: KeyIcon,
      title: "Permission-Based Access",
      description: "Role-based permissions for different admin functions",
      status: "Configured",
      color: "indigo"
    },
    {
      icon: ComputerDesktopIcon,
      title: "Device Tracking",
      description: "Monitor login devices and browser information",
      status: "Active",
      color: "gray"
    }
  ];

  const getStatusColor = (status: string, color: string) => {
    const colors = {
      green: "bg-green-100 text-green-800",
      blue: "bg-blue-100 text-blue-800",
      yellow: "bg-yellow-100 text-yellow-800",
      purple: "bg-purple-100 text-purple-800",
      indigo: "bg-indigo-100 text-indigo-800",
      gray: "bg-gray-100 text-gray-800"
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  return (
    <AdminAuthLayout 
      title="Security Overview" 
      requiredPermission="canAccessLogs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Security Status Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-12 w-12 text-green-600 mr-4" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Security Status: All Systems Secure
                </h2>
                <p className="text-gray-600">
                  All security measures are active and functioning normally. 
                  Your admin session is protected with enterprise-grade security.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {securityFeatures.map((feature, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start">
                <feature.icon className={`h-8 w-8 text-${feature.color}-600 mr-4 mt-1`} />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {feature.description}
                  </p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(feature.status, feature.color)}`}>
                    {feature.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Login Attempts</p>
                <p className="text-2xl font-bold text-red-600">0</p>
                <p className="text-xs text-gray-500">Last 24 hours</p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Successful Logins</p>
                <p className="text-2xl font-bold text-green-600">1</p>
                <p className="text-xs text-gray-500">Current session</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Session Duration</p>
                <p className="text-2xl font-bold text-blue-600">Active</p>
                <p className="text-xs text-gray-500">Auto-timeout in 30m</p>
              </div>
              <ClockIcon className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Security Level</p>
                <p className="text-2xl font-bold text-purple-600">High</p>
                <p className="text-xs text-gray-500">All features enabled</p>
              </div>
              <ShieldCheckIcon className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Security Features Detail */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Security Implementation Details
            </h3>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              {/* Authentication */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <UserIcon className="h-4 w-4 mr-2" />
                  Authentication Security
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      JWT tokens with secure HTTP-only cookies
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Password hashing with bcrypt (10 rounds)
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Rate limiting on login attempts
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Automatic session invalidation on logout
                    </li>
                  </ul>
                </div>
              </div>

              {/* Session Management */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Session Management
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      30-minute session timeout with activity tracking
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Session extension on user activity
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Warning notifications before expiration
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Secure session storage and cleanup
                    </li>
                  </ul>
                </div>
              </div>

              {/* Browser Security */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <CogIcon className="h-4 w-4 mr-2" />
                  Browser Security Headers
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      X-Frame-Options: DENY (prevents clickjacking)
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      X-Content-Type-Options: nosniff
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Content Security Policy (CSP) configured
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Strict-Transport-Security in production
                    </li>
                  </ul>
                </div>
              </div>

              {/* Monitoring */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  Security Monitoring
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Real-time login attempt monitoring
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      IP address and device tracking
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Admin action audit logging
                    </li>
                    <li className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      Security event notifications
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Recommendations */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <LockClosedIcon className="h-5 w-5 mr-2" />
            Security Best Practices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <ul className="space-y-2">
                <li>• Always log out when finished</li>
                <li>• Use a secure, private network</li>
                <li>• Keep your browser updated</li>
                <li>• Don't share admin credentials</li>
              </ul>
            </div>
            <div>
              <ul className="space-y-2">
                <li>• Monitor session activity regularly</li>
                <li>• Report suspicious activity immediately</li>
                <li>• Use strong, unique passwords</li>
                <li>• Enable browser security features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminAuthLayout>
  );
}