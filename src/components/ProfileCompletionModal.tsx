"use client";

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Dynamic import to avoid SSR issues with Mapbox
const MapboxAddressAutocomplete = dynamic(
  () => import('./MapboxAddressAutocomplete'),
  {
    ssr: false,
    loading: () => (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Address
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 animate-pulse">
          Loading address search...
        </div>
      </div>
    )
  }
);

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ProfileCompletionModal({ isOpen, onClose, onComplete }: ProfileCompletionModalProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'CA',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Pre-fill with existing profile data
  useEffect(() => {
    if (session?.user?.profile) {
      const profile = session.user.profile;
      setFormData(prev => ({
        ...prev,
        firstName: profile.firstName || prev.firstName,
        lastName: profile.lastName || prev.lastName,
        phone: profile.phone || '',
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : '',
        streetAddress: profile.streetAddress || '',
        apartment: profile.apartment || '',
        city: profile.city || '',
        state: profile.state || '',
        zipCode: profile.zipCode || '',
        country: profile.country || 'CA',
      }));
    }
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Phone validation
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '');
      if (value && digitsOnly.length < 10) {
        setPhoneError('Phone number must be at least 10 digits');
      } else {
        setPhoneError('');
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate max date for date of birth (must be 18+)
  const getMaxDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    return today.toISOString().split('T')[0];
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.phone.trim()) return 'Phone number is required';
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return 'Phone number must be at least 10 digits';
    if (!formData.dateOfBirth) return 'Date of birth is required';
    if (!formData.streetAddress.trim()) return 'Street address is required';
    if (!formData.city.trim()) return 'City is required';
    if (!formData.state.trim()) return 'Province/State is required';
    if (!formData.zipCode.trim()) return 'Postal/Zip code is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/profile/complete', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete profile');
      }

      // Update the session to reflect profile completion
      await updateSession();

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      } else {
        // Default behavior: redirect to the appropriate dashboard based on user's role
        const role = session?.user?.activeRole || session?.user?.userType || 'PARENT';
        if (role === 'BABYSITTER') {
          router.push('/babysitter-dashboard');
        } else if (role === 'CAREGIVER') {
          router.push('/caregiver-dashboard');
        } else {
          router.push('/parent-dashboard');
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-gray-800 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/50 rounded-2xl pointer-events-none"></div>
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Complete Your Profile</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
            >
              <XMarkIcon className="h-5 w-5 dark:text-gray-400" />
            </button>
          </div>

          {/* Welcome Message */}
          <div className="px-4 pt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Welcome! Please complete your profile to continue using InstaCares.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone<span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(416) 555-1234"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-1 ${
                    phoneError
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:border-rose-500 focus:ring-rose-500'
                  } dark:text-gray-100`}
                  required
                />
                {phoneError && (
                  <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date of Birth<span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  max={getMaxDate()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">You must be 18 or older</p>
              </div>

              {/* Address */}
              <MapboxAddressAutocomplete
                label="Address"
                placeholder="Start typing your address..."
                defaultValue={formData.streetAddress}
                onAddressSelect={(address) => {
                  setFormData(prev => ({
                    ...prev,
                    streetAddress: address.streetAddress,
                    apartment: address.apartment || prev.apartment,
                    city: address.city,
                    state: address.state === 'Ontario' ? 'ON' : address.state,
                    zipCode: address.zipCode,
                    country: address.country || 'CA',
                    latitude: address.latitude,
                    longitude: address.longitude,
                  }));
                }}
                className="text-sm"
                required
              />

              {/* Apartment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Apartment/Unit (Optional)
                </label>
                <input
                  type="text"
                  name="apartment"
                  value={formData.apartment}
                  onChange={handleInputChange}
                  placeholder="e.g., Apt 1A, Unit 205"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Terms Notice */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                By completing your profile, you agree to InstaCares&apos;{' '}
                <a href="/terms" target="_blank" className="text-rose-600 underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-rose-600 underline">Privacy Policy</a>
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
            >
              {isSubmitting ? 'Saving...' : 'Complete Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
