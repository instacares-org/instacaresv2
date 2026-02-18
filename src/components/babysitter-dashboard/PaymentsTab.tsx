'use client';

import dynamic from 'next/dynamic';
import {
  CreditCardIcon,
  BanknotesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

const StripeConnectOnboarding = dynamic(() => import('../StripeConnectOnboarding'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-300">Loading payment setup...</span>
    </div>
  ),
});

interface BabysitterBooking {
  id: string;
  status: string;
  startTime: string;
  subtotal: number;
  paymentMethod: 'ONSITE' | 'PLATFORM';
  parent: { firstName: string; lastName: string; avatar?: string };
}

interface BabysitterProfile {
  stripeOnboarded: boolean;
  stripeConnectId?: string;
  acceptsOnsitePayment: boolean;
}

interface PaymentsTabProps {
  profile: BabysitterProfile | null;
  bookings: BabysitterBooking[];
  totalEarnings: number;
  stripeLoading: boolean;
  showInlineOnboarding: boolean;
  inlineAccountId: string | null;
  onStartStripeOnboarding: () => void;
  onCancelInlineOnboarding: () => void;
  onOnboardingComplete: () => void;
  onUpdateProfile: (data: Partial<BabysitterProfile>) => void;
  formatDate: (isoString: string) => string;
}

export default function PaymentsTab({
  profile,
  bookings,
  totalEarnings,
  stripeLoading,
  showInlineOnboarding,
  inlineAccountId,
  onStartStripeOnboarding,
  onCancelInlineOnboarding,
  onOnboardingComplete,
  onUpdateProfile,
  formatDate,
}: PaymentsTabProps) {
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED');

  const handleOnsiteToggle = async (newValue: boolean) => {
    try {
      const res = await fetch('/api/babysitter/profile', {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ acceptsOnsitePayment: newValue }),
      });
      if (res.ok) {
        onUpdateProfile({ acceptsOnsitePayment: newValue });
      }
    } catch (err) {
      console.error('Failed to update on-site payment setting:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stripe Connect Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Setup</h3>

        <div className="border dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${profile?.stripeOnboarded ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                <CreditCardIcon className={`h-6 w-6 ${profile?.stripeOnboarded ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Stripe Connect</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile?.stripeOnboarded ? 'Connected - Ready to receive payments' : 'Not connected - Set up to receive platform payments'}
                </p>
              </div>
            </div>
            {!profile?.stripeOnboarded ? (
              !showInlineOnboarding ? (
                <button
                  onClick={onStartStripeOnboarding}
                  disabled={stripeLoading}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {stripeLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Setting up...
                    </span>
                  ) : profile?.stripeConnectId && !profile.stripeConnectId.startsWith('acct_demo_') ? 'Complete Setup' : 'Connect Stripe'}
                </button>
              ) : (
                <button
                  onClick={onCancelInlineOnboarding}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel Setup
                </button>
              )
            ) : (
              <span className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-medium">
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Inline Stripe Embedded Onboarding */}
        {showInlineOnboarding && inlineAccountId && (
          <div className="border dark:border-gray-700 rounded-lg p-6 mt-4 bg-gray-50 dark:bg-gray-900/50">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Complete Your Payment Setup</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Complete the form below to start receiving payments. Your information is securely handled by Stripe.
            </p>
            <StripeConnectOnboarding
              stripeAccountId={inlineAccountId}
              onExit={onOnboardingComplete}
            />
          </div>
        )}

        <div className="border dark:border-gray-700 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${profile?.acceptsOnsitePayment ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <BanknotesIcon className={`h-6 w-6 ${profile?.acceptsOnsitePayment ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">On-Site Payments</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile?.acceptsOnsitePayment ? 'Enabled - Accept cash/e-transfer at location' : 'Disabled'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profile?.acceptsOnsitePayment ?? true}
                onChange={(e) => handleOnsiteToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Earnings Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">This Week</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${completedBookings.reduce((sum, b) => sum + b.subtotal, 0).toFixed(0)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalEarnings.toFixed(0)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending Payouts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h3>
        {completedBookings.length === 0 ? (
          <div className="text-center py-8">
            <BanknotesIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No completed transactions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between py-3 border-b dark:border-gray-700 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-300 font-medium">
                      {booking.parent.firstName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {booking.parent.firstName} {booking.parent.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(booking.startTime)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    +${booking.subtotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {booking.paymentMethod === 'ONSITE' ? 'On-site' : 'Platform'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
