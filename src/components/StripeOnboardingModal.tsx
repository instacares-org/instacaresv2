'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
} from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

const StripeConnectOnboarding = dynamic(() => import('./StripeConnectOnboarding'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-300">Loading payment setup...</span>
    </div>
  ),
});

interface StripeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => Promise<string | null>;
  onComplete: () => void;
  isLoading: boolean;
  isDemoMode: boolean;
}

export default function StripeOnboardingModal({
  isOpen,
  onClose,
  onProceed,
  onComplete,
  isLoading,
  isDemoMode
}: StripeOnboardingModalProps) {
  const [embeddedAccountId, setEmbeddedAccountId] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  // Auto-create account when modal opens (skip info phase for real mode)
  useEffect(() => {
    if (isOpen && !isDemoMode && !embeddedAccountId && !isCreatingAccount && !hasStarted.current) {
      hasStarted.current = true;
      setIsCreatingAccount(true);
      setError(null);
      onProceed().then((accountId) => {
        setIsCreatingAccount(false);
        if (accountId) {
          setEmbeddedAccountId(accountId);
        } else {
          setError('Failed to create payment account. Please try again.');
        }
      }).catch(() => {
        setIsCreatingAccount(false);
        setError('Failed to create payment account. Please try again.');
      });
    }
  }, [isOpen, isDemoMode, embeddedAccountId, isCreatingAccount, onProceed]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmbeddedAccountId(null);
      setIsCreatingAccount(false);
      setError(null);
      hasStarted.current = false;
    }
  }, [isOpen]);

  const handleClose = () => {
    if (embeddedAccountId) {
      if (confirm('Are you sure you want to close? You can resume setup later from the Payments tab.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-xl font-bold text-gray-900 dark:text-white">
                    Complete Your Payment Setup
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <XMarkIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Loading state while account is being created */}
                {isCreatingAccount && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-3 border-green-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Setting up your payment account...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This only takes a moment</p>
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="py-8 text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                    <button
                      onClick={() => {
                        setError(null);
                        hasStarted.current = false;
                      }}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium transition"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Embedded Stripe Onboarding */}
                {embeddedAccountId && (
                  <div className="min-h-[400px]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Complete the form below to start receiving payments. Your information is securely handled by Stripe.
                    </p>
                    <StripeConnectOnboarding
                      stripeAccountId={embeddedAccountId}
                      onExit={onComplete}
                    />
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
