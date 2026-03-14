"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { addCSRFHeader } from '@/lib/csrf';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  CreditCardIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

function BookingConfirmationContent() {
  const searchParams = useSearchParams();
  const [paymentStatus, setPaymentStatus] = useState<string>('loading');
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!searchParams) return;

    const paymentIntentId = searchParams.get('payment_intent');

    // Prevent duplicate confirm calls (React strict mode / re-renders)
    if (paymentIntentId && !confirmedRef.current) {
      confirmedRef.current = true;
      confirmPaymentStatus(paymentIntentId);
    }
  }, [searchParams]);

  const confirmPaymentStatus = async (paymentIntentId: string) => {
    try {
      const response = await fetch('/api/stripe/payments/confirm', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ paymentIntentId }),
      });

      const responseData = await response.json();

      // API returns { success, data: { status, id, amount, metadata, ... } }
      const result = responseData.data || responseData;

      if (result.status === 'succeeded' || responseData.success) {
        setPaymentStatus('succeeded');
        setBookingDetails({
          id: result.id,
          amount: result.amount,
          bookingId: result.bookingId,
          caregiverName: result.metadata?.caregiverName,
          bookingDate: result.metadata?.bookingDate,
          startTime: result.metadata?.startTime,
          endTime: result.metadata?.endTime,
          childrenCount: result.metadata?.childrenCount,
          specialRequests: result.metadata?.specialRequests,
        });
      } else {
        setPaymentStatus('failed');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      setPaymentStatus('failed');
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (paymentStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Confirming your booking...</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/20 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 dark:text-red-400 text-2xl">✗</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Payment Failed</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We couldn't process your payment. Please try booking again.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center">
            <div className="relative h-15 w-24">
              <Image
                src="/logo.png"
                fill
                alt="Instacares Logo"
                className="object-contain"
              />
            </div>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Your childcare booking has been successfully confirmed.
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/20 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/30">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Booking Details</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Service Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <UserGroupIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Caregiver</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{bookingDetails?.caregiverName}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <CalendarDaysIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Date</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {bookingDetails?.bookingDate && formatDate(bookingDetails.bookingDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <ClockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Time</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {bookingDetails?.startTime && formatTime(bookingDetails.startTime)} -
                        {bookingDetails?.endTime && formatTime(bookingDetails.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <UserGroupIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Children</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{bookingDetails?.childrenCount}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Payment Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <CreditCardIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Total Paid</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        ${((bookingDetails?.amount || 0) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Status</span>
                      <p className="text-sm text-green-600 dark:text-green-400">Payment Successful</p>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Payment Protection:</strong> Your payment is held securely until service completion.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {bookingDetails?.specialRequests && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Special Requests</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{bookingDetails.specialRequests}</p>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/20 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">What's Next?</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-green-700 dark:text-green-300 text-sm font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Confirmation Email</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  You'll receive a confirmation email with all booking details shortly.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-green-700 dark:text-green-300 text-sm font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Caregiver Contact</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {bookingDetails?.caregiverName} will contact you 24 hours before the booking to confirm details.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                <span className="text-green-700 dark:text-green-300 text-sm font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Service Day</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your caregiver will arrive at the scheduled time. Payment will be released after service completion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-lg font-medium transition"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          
          <Link
            href="/search"
            className="inline-flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            Book Another Service
          </Link>
        </div>

        {/* Support */}
        <div className="text-center mt-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@instacares.com" className="text-rose-500 dark:text-rose-400 hover:text-rose-600">
              support@instacares.com
            </a>{' '}
            or call (555) 123-4567
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BookingConfirmation() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading booking confirmation...</p>
        </div>
      </div>
    }>
      <BookingConfirmationContent />
    </Suspense>
  );
}