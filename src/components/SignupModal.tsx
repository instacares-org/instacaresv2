"use client";

import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import SocialLogin from './SocialLogin';

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

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignupModal({ isOpen, onClose }: SignupModalProps) {
  const [userType, setUserType] = useState<'parent' | 'caregiver'>('parent');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    streetAddress: '',
    apartment: '',
    city: '',
    province: '',
    postalCode: '',
    agreeToTerms: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailValidation, setEmailValidation] = useState({
    isChecking: false,
    exists: false,
    message: '',
    isValid: true
  });

  // Debounced email validation
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || email.length < 3 || !email.includes('@')) {
      setEmailValidation({
        isChecking: false,
        exists: false,
        message: '',
        isValid: true
      });
      return;
    }

    setEmailValidation(prev => ({ ...prev, isChecking: true }));

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const result = await response.json();
        setEmailValidation({
          isChecking: false,
          exists: result.exists,
          message: result.exists 
            ? '⚠️ This email address is already registered. Please use a different email or try logging in.' 
            : '✅ Email address is available',
          isValid: !result.exists
        });
      } else {
        setEmailValidation({
          isChecking: false,
          exists: false,
          message: '',
          isValid: true
        });
      }
    } catch (error) {
      setEmailValidation({
        isChecking: false,
        exists: false,
        message: '',
        isValid: true
      });
    }
  }, []);

  // Debounce email checking
  useEffect(() => {
    const timer = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timer);
  }, [formData.email, checkEmailAvailability]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!formData.agreeToTerms) {
      alert('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (emailValidation.exists) {
      alert('This email address is already registered. Please use a different email or try logging in.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          phone: formData.phone,
          streetAddress: formData.streetAddress,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          userType: userType === 'caregiver' ? 'provider' : 'parent',
          agreeToTerms: formData.agreeToTerms,
        }),
      });

      if (response.ok) {
        alert('Registration successful! Please wait for admin approval.');
        onClose();
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          phone: '',
          streetAddress: '',
          city: '',
          province: '',
          postalCode: '',
          agreeToTerms: false
        });
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('An account with this email address already exists. Please use a different email or try logging in instead.');
        } else {
          alert(errorData.error || errorData.message || 'Registration failed');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-gray-800 relative">
        {/* Background gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/50 rounded-2xl pointer-events-none"></div>
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sign Up</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        {/* User Type Selection */}
        <div className="p-4 border-b dark:border-gray-800">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">I am a...</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setUserType('parent')}
              className={`p-3 rounded-lg border-2 transition ${
                userType === 'parent'
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-center">
                <div className="text-xl mb-1">👨‍👩‍👧‍👦</div>
                <div className="font-medium text-sm">Parent</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Looking for childcare</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setUserType('caregiver')}
              className={`p-3 rounded-lg border-2 transition ${
                userType === 'caregiver'
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-center">
                <div className="text-xl mb-1">👩‍🏫</div>
                <div className="font-medium text-sm">Caregiver</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Offering services</div>
              </div>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-3">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                    emailValidation.exists
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-400'
                      : emailValidation.message && emailValidation.isValid
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                      : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:border-rose-500 dark:focus:border-rose-400'
                  } dark:text-gray-100`}
                  required
                />
                {emailValidation.isChecking && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-600"></div>
                  </div>
                )}
              </div>
              {emailValidation.message && (
                <div className={`mt-1 text-xs ${
                  emailValidation.exists
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {emailValidation.message}
                </div>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
              />
            </div>

            {/* Address with Autocomplete */}
            <div>
              <MapboxAddressAutocomplete
                label="Address"
                placeholder="Start typing your address..."
                defaultValue={formData.streetAddress ? `${formData.streetAddress}${formData.city ? `, ${formData.city}` : ''}${formData.province ? `, ${formData.province}` : ''}${formData.postalCode ? ` ${formData.postalCode}` : ''}` : ''}
                onAddressSelect={(address) => {
                  setFormData(prev => ({
                    ...prev,
                    streetAddress: address.streetAddress,
                    apartment: address.apartment || '',
                    city: address.city,
                    province: address.state === 'Ontario' ? 'ON' : address.state,
                    postalCode: address.zipCode
                  }));
                }}
                className="text-sm"
              />
            </div>

            {/* Apartment/Unit Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Apartment/Unit Number (Optional)
              </label>
              <input
                type="text"
                value={formData.apartment}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  apartment: e.target.value
                }))}
                placeholder="e.g., Apt 1A, Unit 205"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Show selected address details */}
            {(formData.streetAddress || formData.city || formData.province || formData.postalCode) && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Selected Address:</div>
                <div className="text-sm text-gray-800 dark:text-gray-200">
                  {formData.streetAddress && (
                    <div>
                      {formData.streetAddress}
                      {formData.apartment && `, ${formData.apartment}`}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {formData.city && <span>{formData.city}</span>}
                    {formData.province && <span>{formData.province}</span>}
                    {formData.postalCode && <span>{formData.postalCode}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleInputChange}
                className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded"
                required
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">
                I acknowledge that I have read, understood, and agree to be bound by InstaCares'{' '}
                <a href="/terms" target="_blank" className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 underline font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 underline font-medium">
                  Privacy Policy
                </a>
                . I understand that I am waiving certain legal rights, including the right to sue or claim compensation in certain circumstances.
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || emailValidation.exists || emailValidation.isChecking}
            className="w-full mt-4 bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700 text-white py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? 'Creating Account...' : emailValidation.exists ? 'Email Already Exists' : 'Sign Up'}
          </button>

          {/* Social Login Options */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or sign up with</span>
              </div>
            </div>
            <SocialLogin 
              userType={userType} 
              onSocialLogin={(provider, userType) => {
                console.log(`Social signup successful with ${provider} as ${userType}`);
                onClose();
                // Redirect to appropriate dashboard
                if (userType === 'parent') {
                  window.location.href = '/parent-dashboard';
                } else {
                  window.location.href = '/caregiver-dashboard';
                }
              }}
            />
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}