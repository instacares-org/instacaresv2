'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface ProfileCompletionStatus {
  isComplete: boolean;
  approvalStatus: string;
  completionPercentage: number;
  missingItems: string[];
  completedItems: string[];
}

export default function ProfileCompletionBanner() {
  const { data: session } = useSession();
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompletionStatus() {
      try {
        const response = await fetch('/api/caregiver/profile-completion');
        if (response.ok) {
          const data = await response.json();
          setCompletionStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch profile completion status:', error);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchCompletionStatus();
    }
  }, [session]);

  if (loading || !completionStatus) return null;

  // Don't show banner if already approved
  if (completionStatus.approvalStatus === 'APPROVED') {
    return (
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
        <div className="flex items-center">
          <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-green-800">
              Profile Approved & Verified
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Your profile is live and visible to parents searching for caregivers!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Profile pending approval
  if (completionStatus.approvalStatus === 'PENDING') {
    if (completionStatus.isComplete) {
      return (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-center">
            <ClockIcon className="h-6 w-6 text-blue-500 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Profile Under Review
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Your profile is complete and submitted for admin approval. You'll be notified once approved!
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      // Profile incomplete
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
          <div className="flex items-start">
            <ExclamationCircleIcon className="h-6 w-6 text-yellow-500 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Complete Your Profile ({completionStatus.completionPercentage}%)
              </h3>
              <p className="text-sm text-yellow-700 mt-1 mb-3">
                Complete the following steps to submit your profile for approval:
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-yellow-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completionStatus.completionPercentage}%` }}
                ></div>
              </div>

              {/* Completion Checklist */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">
                  Completed:
                </p>
                {completionStatus.completedItems.map((item, index) => (
                  <div key={index} className="flex items-center text-sm text-yellow-700">
                    <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                    {item}
                  </div>
                ))}

                {completionStatus.missingItems.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mt-3">
                      Required:
                    </p>
                    {completionStatus.missingItems.map((item, index) => (
                      <div key={index} className="flex items-center text-sm text-yellow-700">
                        <ExclamationCircleIcon className="h-4 w-4 text-yellow-600 mr-2" />
                        {item}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button className="mt-4 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition">
                Complete Profile Now
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Rejected or suspended
  if (completionStatus.approvalStatus === 'REJECTED' || completionStatus.approvalStatus === 'SUSPENDED') {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex items-center">
          <ExclamationCircleIcon className="h-6 w-6 text-red-500 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Profile {completionStatus.approvalStatus === 'REJECTED' ? 'Rejected' : 'Suspended'}
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Please contact support for more information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
