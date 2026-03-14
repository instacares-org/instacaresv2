"use client";

import { useState } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCSRFTokenFromCookie } from '@/lib/csrf';

interface AddCaregiverRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCaregiverRoleModal({ isOpen, onClose }: AddCaregiverRoleModalProps) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Questionnaire data for caregivers (same as SignupModal)
  const [questionnaireData, setQuestionnaireData] = useState({
    hasInsurance: null as boolean | null,
    hasFireAlarmCO: null as boolean | null,
    hasPets: null as boolean | null,
    petsDescription: '',
    hasBackgroundCheck: null as boolean | null,
    hasFirstAidCPR: null as boolean | null,
    hasOtherCertifications: null as boolean | null,
    otherCertificationsDescription: ''
  });

  // Caregiver profile data
  const [caregiverData, setCaregiverData] = useState({
    bio: '',
    hourlyRate: 25,
    experienceYears: 0,
    specialties: [] as string[]
  });

  const totalSteps = 2; // Step 1: Questionnaire, Step 2: Caregiver Profile

  const handleQuestionnaireChange = (field: string, value: boolean | string) => {
    setQuestionnaireData(prev => ({ ...prev, [field]: value }));
  };

  const isQuestionnaireComplete = () => {
    return (
      questionnaireData.hasInsurance !== null &&
      questionnaireData.hasFireAlarmCO !== null &&
      questionnaireData.hasPets !== null &&
      questionnaireData.hasBackgroundCheck !== null &&
      questionnaireData.hasFirstAidCPR !== null &&
      questionnaireData.hasOtherCertifications !== null
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get CSRF token from cookie using the proper library function
      const csrfToken = getCSRFTokenFromCookie();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add CSRF token to headers if available
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch('/api/user/add-caregiver-role', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          caregiverData: {
            ...caregiverData,
            questionnaireData
          }
        })
      });

      if (response.ok) {
        // Refresh user data to get updated roles
        await refreshUser();
        onClose();
        // Redirect to caregiver dashboard
        router.push('/caregiver-dashboard');
      } else {
        const data = await response.json();
        setError(data.data?.error || data.error || 'Failed to add caregiver role');
      }
    } catch (err) {
      console.error('Error adding caregiver role:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && isQuestionnaireComplete()) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Become a Caregiver
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Add caregiver role to your account
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="mt-4 flex items-center gap-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    step <= currentStep
                      ? 'bg-amber-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Step {currentStep} of {totalSteps}: {currentStep === 1 ? 'Questionnaire' : 'Profile Details'}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Questionnaire */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Please answer these questions to help parents understand your caregiving setup.
                </div>

                {/* Insurance */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Do you have liability insurance for childcare?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasInsurance', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasInsurance === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasInsurance', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasInsurance === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Fire Alarm/CO */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Do you have working fire alarms and CO detectors?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasFireAlarmCO', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasFireAlarmCO === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasFireAlarmCO', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasFireAlarmCO === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Pets */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Do you have any pets?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasPets', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasPets === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasPets', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasPets === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                  {questionnaireData.hasPets && (
                    <input
                      type="text"
                      placeholder="Describe your pets (type, breed, etc.)"
                      value={questionnaireData.petsDescription}
                      onChange={(e) => handleQuestionnaireChange('petsDescription', e.target.value)}
                      className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Background Check */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Have you completed a background check?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasBackgroundCheck', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasBackgroundCheck === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasBackgroundCheck', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasBackgroundCheck === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* First Aid/CPR */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Are you First Aid and CPR certified?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasFirstAidCPR', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasFirstAidCPR === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasFirstAidCPR', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasFirstAidCPR === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Other Certifications */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-3">
                    Do you have any other childcare certifications?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasOtherCertifications', true)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasOtherCertifications === true
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionnaireChange('hasOtherCertifications', false)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                        questionnaireData.hasOtherCertifications === false
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                  {questionnaireData.hasOtherCertifications && (
                    <input
                      type="text"
                      placeholder="List your certifications"
                      value={questionnaireData.otherCertificationsDescription}
                      onChange={(e) => handleQuestionnaireChange('otherCertificationsDescription', e.target.value)}
                      className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Caregiver Profile */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Tell parents a bit about yourself as a caregiver.
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    About Me
                  </label>
                  <textarea
                    value={caregiverData.bio}
                    onChange={(e) => setCaregiverData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell parents about your experience, approach to childcare, and what makes you a great caregiver..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={caregiverData.experienceYears}
                    onChange={(e) => setCaregiverData(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="100"
                    value={caregiverData.hourlyRate}
                    onChange={(e) => setCaregiverData(prev => ({ ...prev, hourlyRate: parseInt(e.target.value) || 25 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Suggested range: $18-$35/hour based on your location and experience
                  </p>
                </div>

                {/* Info box */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                        Your caregiver profile will be pending approval
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Our team will review your application and notify you once approved.
                        You can continue using InstaCares as a parent in the meantime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                Back
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
            )}

            <button
              onClick={handleNextStep}
              disabled={currentStep === 1 && !isQuestionnaireComplete() || isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                (currentStep === 1 && !isQuestionnaireComplete()) || isSubmitting
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : currentStep === totalSteps ? (
                'Submit Application'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
