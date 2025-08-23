"use client";

import { useState } from "react";
import { ClockIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";

interface UserStatus {
  id: string;
  email: string;
  userType: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  profile?: {
    firstName: string;
    lastName: string;
  };
}

export default function AccountStatusPage() {
  const [email, setEmail] = useState('');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/users/status?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (response.ok) {
        setUserStatus(data.user);
      } else {
        setError(data.error || 'User not found');
        setUserStatus(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check account status. Please try again.');
      setUserStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <ClockIcon className="h-8 w-8 text-yellow-500" />;
      case 'APPROVED':
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case 'REJECTED':
        return <XCircleIcon className="h-8 w-8 text-red-500" />;
      case 'SUSPENDED':
        return <XCircleIcon className="h-8 w-8 text-red-500" />;
      default:
        return <InformationCircleIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          title: 'Account Pending Approval',
          message: 'Your account is currently being reviewed by our admin team. We will notify you once your account has been approved.',
          color: 'text-yellow-700',
          bgColor: 'bg-yellow-50 border-yellow-200'
        };
      case 'APPROVED':
        return {
          title: 'Account Approved!',
          message: 'Congratulations! Your account has been approved and you can now access all platform features.',
          color: 'text-green-700',
          bgColor: 'bg-green-50 border-green-200'
        };
      case 'REJECTED':
        return {
          title: 'Account Rejected',
          message: 'Unfortunately, your account application was not approved. Please contact support for more information.',
          color: 'text-red-700',
          bgColor: 'bg-red-50 border-red-200'
        };
      case 'SUSPENDED':
        return {
          title: 'Account Suspended',
          message: 'Your account has been suspended. Please contact support for assistance.',
          color: 'text-red-700',
          bgColor: 'bg-red-50 border-red-200'
        };
      default:
        return {
          title: 'Unknown Status',
          message: 'Unable to determine account status.',
          color: 'text-gray-700',
          bgColor: 'bg-gray-50 border-gray-200'
        };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center">
            <div className="relative h-15 w-24">
              <Image
                src="/logo.png"
                fill
                alt="Instacares Logo"
                className="object-contain"
              />
            </div>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <InformationCircleIcon className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Check Account Status
            </h2>
            <p className="text-gray-600">
              Enter your email to check your account approval status
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition duration-150 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  'Check Status'
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Status Display */}
            {userStatus && (
              <div className="mt-6">
                <div className={`border rounded-lg p-4 ${getStatusMessage(userStatus.approvalStatus).bgColor}`}>
                  <div className="flex items-center space-x-3 mb-3">
                    {getStatusIcon(userStatus.approvalStatus)}
                    <div>
                      <h3 className={`text-lg font-semibold ${getStatusMessage(userStatus.approvalStatus).color}`}>
                        {getStatusMessage(userStatus.approvalStatus).title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {userStatus.profile ? `${userStatus.profile.firstName} ${userStatus.profile.lastName}` : userStatus.email}
                      </p>
                    </div>
                  </div>
                  
                  <p className={`text-sm ${getStatusMessage(userStatus.approvalStatus).color} mb-3`}>
                    {getStatusMessage(userStatus.approvalStatus).message}
                  </p>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Account Type: <span className="font-medium">{userStatus.userType}</span></p>
                    <p>Applied: <span className="font-medium">{new Date(userStatus.createdAt).toLocaleDateString()}</span></p>
                  </div>
                </div>

                {userStatus.approvalStatus === 'APPROVED' && (
                  <div className="mt-4">
                    <Link
                      href={userStatus.userType === 'PARENT' ? '/parent-dashboard' : '/caregiver-dashboard'}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150 inline-block text-center"
                    >
                      Access Dashboard
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="text-center space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Need Help?</h3>
              <p className="text-sm text-blue-700">
                If you have questions about your account status or need assistance, please contact our support team.
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p>
                Don't have an account?{" "}
                <Link href="/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
                  Sign up here
                </Link>
              </p>
              <p>
                Already approved?{" "}
                <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}