'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';
import { formatCAD } from '@/lib/currency';
import { useStripeAppearance } from '@/hooks/useStripeAppearance';

// ---------------------------------------------------------------------------
// Stripe singleton (lazy-loaded)
// ---------------------------------------------------------------------------
let stripePromise: Promise<Stripe | null> | null = null;
const getStripePromise = () => {
  if (!stripePromise) {
    stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_')
      ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
      : Promise.resolve(null);
  }
  return stripePromise;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExtensionData {
  id: string;
  bookingId: string;
  extensionMinutes: number;
  extensionAmount: number;
  hourlyRate: number;
  platformFee: number;
  originalEndTime: string;
  newEndTime: string;
  status: 'PAYMENT_PENDING' | 'FAILED';
  reason: string | null;
  createdAt: string;
  booking: {
    id: string;
    startTime: string;
    endTime: string;
    address: string;
    status: string;
    caregiver: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    };
  };
}

// ---------------------------------------------------------------------------
// ExtensionPaymentForm -- rendered inside <Elements> with a clientSecret
// ---------------------------------------------------------------------------
function ExtensionPaymentForm({
  extensionId,
  paymentIntentId,
  onSuccess,
  onError,
}: {
  extensionId: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/parent-dashboard?tab=bookings`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message ?? 'Payment failed. Please try again.');
      } else {
        // Payment succeeded — immediately confirm with backend so DB is
        // updated before any page refresh (closes the webhook race condition)
        try {
          await fetch(`/api/extensions/${extensionId}/confirm-payment`, {
            method: 'POST',
            headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ paymentIntentId }),
          });
        } catch {
          // If confirm-payment fails, the webhook will still handle it
          console.warn('[ExtensionPayment] confirm-payment call failed, webhook will handle');
        }

        onSuccess();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: 'tabs' }}
      />

      <button
        type="submit"
        disabled={!stripe || !elements || submitting || !ready}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                   bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                   text-white font-semibold transition-colors
                   dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600"
      >
        {submitting ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            Confirm Payment
          </>
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ExtensionPaymentCard -- one card per pending extension
// ---------------------------------------------------------------------------
function ExtensionPaymentCard({
  extension,
  onPaid,
}: {
  extension: ExtensionData;
  onPaid: (extensionId: string) => void;
}) {
  const stripeAppearance = useStripeAppearance();
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const caregiverName = [
    extension.booking.caregiver.firstName,
    extension.booking.caregiver.lastName,
  ]
    .filter(Boolean)
    .join(' ') || 'Your caregiver';

  // Initiate the payment flow: call the pay endpoint to get a clientSecret
  const handlePayNow = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/extensions/${extension.id}/pay`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        setError(body.error ?? 'Failed to initiate payment');
        return;
      }

      // If pay endpoint detected it's already paid, just mark it
      if (body.data.alreadyPaid) {
        setPaid(true);
        setTimeout(() => setFadeOut(true), 2500);
        setTimeout(() => onPaid(extension.id), 3500);
        return;
      }

      setClientSecret(body.data.clientSecret);
      setPaymentIntentId(body.data.paymentIntentId);
      setShowPayment(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Network error. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Called when Stripe confirms payment successfully
  const handleSuccess = useCallback(() => {
    setPaid(true);
    setShowPayment(false);
    setClientSecret(null);

    // Fade the card out after a brief success display
    setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    setTimeout(() => {
      onPaid(extension.id);
    }, 3500);
  }, [extension.id, onPaid]);

  // Called when Stripe returns an error
  const handlePaymentError = useCallback((message: string) => {
    setError(message);
    setShowPayment(false);
    setClientSecret(null);
  }, []);

  // Cancel the inline payment form
  const handleCancelPayment = () => {
    setShowPayment(false);
    setClientSecret(null);
    setPaymentIntentId(null);
    setError(null);
  };

  // Status badge
  const statusBadge =
    extension.status === 'FAILED' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
        <Clock className="h-3 w-3" />
        Payment Pending
      </span>
    );

  if (paid) {
    return (
      <div
        className={`rounded-lg border border-green-200 bg-green-50 p-4 transition-opacity duration-1000
                    dark:border-green-800 dark:bg-green-900/30
                    ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">
              Payment confirmed!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Your booking with {caregiverName} has been extended by{' '}
              {extension.extensionMinutes} minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              Extension &mdash; {caregiverName}
            </h3>
            {statusBadge}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {extension.extensionMinutes} additional minutes
            {extension.reason ? ` \u2014 ${extension.reason}` : ''}
          </p>
        </div>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
          {formatCAD(extension.extensionAmount)}
        </p>
      </div>

      {/* Card body */}
      <div className="px-4 pb-4 space-y-3">
        {/* Extension time info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {new Date(extension.originalEndTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' \u2192 '}
            {new Date(extension.newEndTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment form or Pay Now button */}
        {showPayment && clientSecret ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter payment details
              </p>
              <button
                onClick={handleCancelPayment}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors
                           dark:hover:text-gray-200 dark:hover:bg-gray-700"
                aria-label="Cancel payment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Elements
              stripe={getStripePromise()}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <ExtensionPaymentForm
                extensionId={extension.id}
                paymentIntentId={paymentIntentId!}
                onSuccess={handleSuccess}
                onError={handlePaymentError}
              />
            </Elements>
          </div>
        ) : (
          <button
            onClick={handlePayNow}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                       bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       text-white font-semibold transition-colors
                       dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pay Now
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExtensionPaymentBanner -- top-level component to mount on parent dashboard
// ---------------------------------------------------------------------------
export default function ExtensionPaymentBanner() {
  const [extensions, setExtensions] = useState<ExtensionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchExtensions = useCallback(async () => {
    try {
      setFetchError(null);
      console.log('[ExtensionBanner] Fetching pending extensions...');
      const res = await fetch('/api/extensions');
      const body = await res.json();
      console.log('[ExtensionBanner] Response:', res.status, body);

      if (!res.ok || !body.success) {
        setFetchError(body.error ?? 'Failed to load extensions');
        return;
      }

      setExtensions(body.data ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Network error loading extensions';
      console.error('[ExtensionBanner] Fetch error:', message);
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  // Remove a paid extension from the local list (the card handles the fade).
  const handlePaid = useCallback((extensionId: string) => {
    setExtensions((prev) => prev.filter((e) => e.id !== extensionId));
  }, []);

  // Don't render anything while loading or if there are no actionable extensions
  // (but still show fetch errors so they're not silently swallowed)
  if (loading) {
    return null;
  }

  if (extensions.length === 0 && !fetchError) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-orange-500 dark:text-orange-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {extensions.length === 1
            ? 'Booking Extension \u2014 Payment Required'
            : `${extensions.length} Booking Extensions \u2014 Payment Required`}
        </h2>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Extension cards */}
      <div className="space-y-3">
        {extensions.map((ext) => (
          <ExtensionPaymentCard
            key={ext.id}
            extension={ext}
            onPaid={handlePaid}
          />
        ))}
      </div>
    </div>
  );
}
