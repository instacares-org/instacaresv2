"use client";

import { useState } from 'react';
import { XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'parent' | 'caregiver' | null;
}

export default function LoginModal({ isOpen, onClose, userType }: LoginModalProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await login(formData.email, formData.password, userType);
      
      if (result.success) {
        onClose();
        // Redirect to appropriate dashboard
        if (userType === 'parent') {
          window.location.href = '/parent-dashboard';
        } else {
          window.location.href = '/caregiver-dashboard';
        }
      } else {
        alert(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !userType) return null;

  const userTypeConfig = {
    parent: {
      title: 'Parent Login',
      subtitle: 'Access your parent dashboard',
      icon: '👨‍👩‍👧‍👦',
      color: 'teal',
      bgColor: 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconRing: 'ring-teal-200 dark:ring-teal-800'
    },
    caregiver: {
      title: 'Caregiver Login',
      subtitle: 'Access your caregiver dashboard',
      icon: '👩‍🏫',
      color: 'amber',
      bgColor: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconRing: 'ring-amber-200 dark:ring-amber-800'
    }
  };

  const config = userTypeConfig[userType];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full shadow-2xl border border-white/20 dark:border-gray-800 relative">
        {/* Background gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/50 rounded-2xl pointer-events-none"></div>
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 ${config.iconBg} rounded-full flex items-center justify-center ring-2 ${config.iconRing}`}>
              <span className="text-2xl">{config.icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
          >
            <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📧 Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 transition-all duration-200"
                required
                placeholder="Enter your email address"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔒 Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 transition-all duration-200"
                required
                placeholder="Enter your password"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-right mt-3">
            <button
              type="button"
              className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-all duration-200 underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full mt-6 ${config.bgColor} text-white py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              `🚀 Sign In as ${userType === 'parent' ? 'Parent' : 'Caregiver'}`
            )}
          </button>

          {/* Social Login Options */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
              >
                <img src="/google-icon.svg" alt="Google" className="w-5 h-5 mr-2" />
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
              >
                <img src="/facebook-icon.svg" alt="Facebook" className="w-5 h-5 mr-2" />
                Facebook
              </button>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Don't have an account?
            </p>
            <button
              type="button"
              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold transition-all duration-200 underline-offset-4 hover:underline"
              onClick={() => {
                onClose();
                // This could trigger opening the signup modal
              }}
            >
              ✨ Create {userType === 'parent' ? 'Parent' : 'Caregiver'} Account
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}