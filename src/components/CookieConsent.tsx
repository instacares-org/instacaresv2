'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const STORAGE_KEY = 'instacares_cookie_consent';

interface ConsentData {
  status: string;
  timestamp: string;
}

function getConsent(): ConsentData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.status === 'accepted' && parsed?.timestamp) {
      return parsed as ConsentData;
    }
    return null;
  } catch {
    return null;
  }
}

function setConsent(): void {
  try {
    const data: ConsentData = {
      status: 'accepted',
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable in some browsers / private mode
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    // Only check on the client after hydration
    const existing = getConsent();
    if (!existing) {
      setVisible(true);
      // Trigger the slide-up animation on the next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateIn(true);
        });
      });
    }
  }, []);

  const handleAccept = () => {
    setConsent();
    setAnimateIn(false);
    // Wait for the slide-down animation to finish before unmounting
    setTimeout(() => {
      setVisible(false);
    }, 300);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-[9999] flex justify-center px-4 pb-4 sm:pb-6 transition-transform duration-300 ease-out ${
        animateIn ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30">
            <ShieldCheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:hidden mb-2">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30">
                <ShieldCheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Cookie Notice
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              We use cookies to enhance your experience, manage your session, and process payments
              securely. By continuing to use InstaCares, you consent to our use of cookies as
              described in our{' '}
              <Link
                href="/privacy"
                className="text-green-600 dark:text-green-400 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-300"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={handleAccept}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Accept All
            </button>
            <Link
              href="/privacy"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
