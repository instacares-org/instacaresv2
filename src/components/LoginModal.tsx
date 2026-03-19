"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import SocialLogin from './SocialLogin';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'parent' | 'caregiver' | 'babysitter' | null;
}

export default function LoginModal({ isOpen, onClose, userType }: LoginModalProps) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');

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
    setError('');

    try {
      if (needs2FA) {
        // Second step: retry login with the 2FA code
        const result = await login(formData.email, formData.password, userType || 'parent', false, twoFactorCode);
        if (result.success) {
          setNeeds2FA(false);
          setTwoFactorCode('');
          onClose();
        } else {
          setError(result.error || 'Invalid 2FA code');
        }
      } else {
        // First step: email + password
        const result = await login(formData.email, formData.password, userType || 'parent');
        if (result.success) {
          onClose();
        } else if (result.status === '2fa_required') {
          // Password was correct, now ask for 2FA code
          setNeeds2FA(true);
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !userType) return null;

  const userTypeConfig = {
    parent: {
      title: t('auth.parentLogin'),
      subtitle: t('auth.accessParentDashboard'),
      icon: '👨‍👩‍👧‍👦',
      color: 'teal',
      bgColor: 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconRing: 'ring-teal-200 dark:ring-teal-800'
    },
    caregiver: {
      title: t('auth.caregiverLogin'),
      subtitle: t('auth.accessCaregiverDashboard'),
      icon: '👩‍🏫',
      color: 'amber',
      bgColor: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconRing: 'ring-amber-200 dark:ring-amber-800'
    },
    babysitter: {
      title: 'Babysitter Login',
      subtitle: 'Access your babysitter dashboard',
      icon: '👶',
      color: 'purple',
      bgColor: 'bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconRing: 'ring-purple-200 dark:ring-purple-800'
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
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {needs2FA ? (
            /* 2FA Code Step */
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔐</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-4 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200 text-center text-2xl font-mono tracking-[0.5em]"
                  required
                  autoFocus
                  placeholder="000000"
                />
              </div>
              <button
                type="button"
                onClick={() => { setNeeds2FA(false); setTwoFactorCode(''); setError(''); }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
              >
                ← Back to login
              </button>
            </div>
          ) : (
            /* Email + Password Step */
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 transition-all duration-200"
                  required
                  placeholder={t('auth.enterEmail')}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 transition-all duration-200"
                  required
                  placeholder={t('auth.enterPassword')}
                />
              </div>
            </div>
          )}

          {!needs2FA && (
            /* Forgot Password Link */
            <div className="text-right mt-3">
              <button
                type="button"
                onClick={() => {
                  router.push('/forgot-password');
                  onClose();
                }}
                className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-all duration-200 underline-offset-4 hover:underline"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || (needs2FA && twoFactorCode.length !== 6)}
            className={`w-full mt-6 ${config.bgColor} text-white py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{needs2FA ? 'Verifying...' : t('auth.signingIn')}</span>
              </div>
            ) : needs2FA ? (
              'Verify & Sign In'
            ) : (
              t('auth.signInAs', { userType: userType === 'parent' ? t('auth.parent') : userType === 'babysitter' ? 'Babysitter' : t('auth.caregiver') })
            )}
          </button>

          {!needs2FA && (
            <>
              {/* Social Login Options */}
              <div className="mt-6 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">{t('auth.orContinueWith')}</span>
                  </div>
                </div>
                <SocialLogin
                  userType={userType || 'parent'}
                  onSocialLogin={(provider, userType) => {
                    console.log(`Social login successful with ${provider} as ${userType}`);
                    onClose();
                  }}
                />
              </div>

              {/* Sign Up Link */}
              <div className="text-center mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('auth.noAccount')}
                </p>
                <button
                  type="button"
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold transition-all duration-200 underline-offset-4 hover:underline"
                  onClick={() => {
                    onClose();
                  }}
                >
                  {t('auth.createAccount', { userType: userType === 'parent' ? t('auth.parent') : userType === 'babysitter' ? 'Babysitter' : t('auth.caregiver') })}
                </button>
              </div>
            </>
          )}
        </form>
        </div>
      </div>
    </div>
  );
}