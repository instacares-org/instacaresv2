'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface StripeRedirectLoadingProps {
  isOpen: boolean;
}

export default function StripeRedirectLoading({ isOpen }: StripeRedirectLoadingProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-8 text-center shadow-xl transition-all">
                {/* Animated Stripe Logo */}
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    {/* Outer ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                    {/* Spinning ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-600 animate-spin"></div>
                    {/* Inner content */}
                    <div className="relative flex items-center justify-center w-24 h-24">
                      <svg className="h-12 w-12" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.10 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.9 0 1.85 6.29.97 6.29 5.88z" fill="#635BFF"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Connecting to Stripe
                </Dialog.Title>

                {/* Description */}
                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    You'll be redirected to Stripe's secure platform in a moment.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Please don't close this window.
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-600 flex items-center justify-center mr-3">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">Creating secure connection</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center mr-3">
                        <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">Preparing payment setup</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 mr-3"></div>
                      <span className="text-gray-400">Redirecting to Stripe</span>
                    </div>
                  </div>
                </div>

                {/* Trust Badge */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-medium">Secured by Stripe</span>
                    <span className="text-gray-400">•</span>
                    <span>Bank-level encryption</span>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
