'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CheckCircleIcon, BanknotesIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';

interface StripeOnboardingSuccessProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StripeOnboardingSuccess({
  isOpen,
  onClose
}: StripeOnboardingSuccessProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Animate through steps
      const timer1 = setTimeout(() => setStep(1), 500);
      const timer2 = setTimeout(() => setStep(2), 1000);
      const timer3 = setTimeout(() => setStep(3), 1500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl transition-all">
                {/* Success Icon */}
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-16 h-16 text-green-600" />
                    </div>
                    {/* Pulse animation */}
                    <div className="absolute inset-0 w-24 h-24 bg-green-600 rounded-full opacity-25 animate-ping"></div>
                  </div>
                </div>

                {/* Title */}
                <Dialog.Title as="h2" className="text-3xl font-bold text-green-900 mb-3">
                  Payment Account Set Up Successfully!
                </Dialog.Title>

                {/* Subtitle */}
                <p className="text-lg text-green-800 mb-8">
                  You're all set to receive payments from parents. Bookings will automatically be deposited to your bank account.
                </p>

                {/* What's Next Section */}
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    What happens next?
                  </h3>

                  <div className="space-y-4">
                    <Transition
                      show={step >= 1}
                      enter="transition-all duration-500"
                      enterFrom="opacity-0 translate-x-4"
                      enterTo="opacity-100 translate-x-0"
                    >
                      <div className="flex items-start bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                          <CalendarDaysIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Parents can now book your services</h4>
                          <p className="text-sm text-gray-600">
                            Your profile is live! Parents can search for you, view your availability, and book sessions with you.
                          </p>
                        </div>
                      </div>
                    </Transition>

                    <Transition
                      show={step >= 2}
                      enter="transition-all duration-500"
                      enterFrom="opacity-0 translate-x-4"
                      enterTo="opacity-100 translate-x-0"
                    >
                      <div className="flex items-start bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                          <BanknotesIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Automatic payment processing</h4>
                          <p className="text-sm text-gray-600">
                            After each completed booking, you'll receive payment 2-3 business days later, directly to your bank account.
                          </p>
                        </div>
                      </div>
                    </Transition>

                    <Transition
                      show={step >= 3}
                      enter="transition-all duration-500"
                      enterFrom="opacity-0 translate-x-4"
                      enterTo="opacity-100 translate-x-0"
                    >
                      <div className="flex items-start bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                          <ChartBarIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Track your earnings</h4>
                          <p className="text-sm text-gray-600">
                            View detailed earnings reports, upcoming payouts, and booking history in the "Payments & Payouts" tab.
                          </p>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                  <h4 className="font-semibold text-blue-900 mb-2">Recommended next steps:</h4>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2 mt-0.5">1.</span>
                      <span>Post your availability so parents can find and book you</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2 mt-0.5">2.</span>
                      <span>Complete your profile with photos and description</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2 mt-0.5">3.</span>
                      <span>Set your care preferences and specialties</span>
                    </li>
                  </ul>
                </div>

                {/* Action Button */}
                <button
                  onClick={onClose}
                  className="w-full bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 font-semibold text-lg transition shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Go to Dashboard
                </button>

                {/* Support Note */}
                <p className="text-sm text-gray-500 mt-4">
                  Questions? Check out the <a href="#" className="text-green-600 hover:underline">Help Center</a> or contact support.
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
