"use client";

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { ArrowLeftIcon, CreditCardIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Caregiver } from './CaregiverCard';

interface BookingFormProps {
  clientSecret: string;
  bookingDetails: {
    date: string;
    startTime: string;
    endTime: string;
    childrenCount: number;
    specialRequests: string;
  };
  caregiver: Caregiver;
  totalAmount: number;
  onSuccess: () => void;
  onBack: () => void;
}

export default function BookingForm({
  clientSecret,
  bookingDetails,
  caregiver,
  totalAmount,
  onSuccess,
  onBack,
}: BookingFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Check if this is a demo mode payment
  const isDemoMode = clientSecret.includes('_secret_demo');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsProcessing(true);
    setErrorMessage('');

    try {
      if (isDemoMode) {
        // Simulate processing time for demo
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate success in demo mode
        console.log('Demo payment completed successfully');
        onSuccess();
        return;
      }

      if (!stripe || !elements) {
        setErrorMessage('Payment system not loaded. Please refresh the page.');
        return;
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-confirmation`,
          receipt_email: 'parent@example.com', // In real app, get from auth
        },
      });

      if (error) {
        setErrorMessage(error.message || 'An unexpected error occurred.');
      } else {
        // Payment succeeded
        onSuccess();
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const calculateHours = () => {
    const start = new Date(`2000-01-01T${bookingDetails.startTime}:00`);
    const end = new Date(`2000-01-01T${bookingDetails.endTime}:00`);
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  };

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Details
      </button>

      {/* Booking Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Booking Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Caregiver:</span>
            <span className="font-medium">{caregiver.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span className="font-medium">
              {new Date(bookingDetails.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Time:</span>
            <span className="font-medium">
              {formatTime(bookingDetails.startTime)} - {formatTime(bookingDetails.endTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium">{calculateHours()} hours</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Children:</span>
            <span className="font-medium">{bookingDetails.childrenCount}</span>
          </div>
          {bookingDetails.specialRequests && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-600 text-xs block mb-1">Special Requests:</span>
              <span className="text-sm">{bookingDetails.specialRequests}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-medium">Total Amount:</span>
            <span className="font-bold text-lg">${(totalAmount / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center mb-3">
            <CreditCardIcon className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
          </div>
          
          {isDemoMode ? (
            <div className="p-6 border-2 border-dashed border-yellow-300 rounded-lg bg-yellow-50">
              <div className="text-center">
                <div className="text-3xl mb-2">🎭</div>
                <h4 className="text-lg font-medium text-yellow-800 mb-2">Demo Mode</h4>
                <p className="text-yellow-700 text-sm mb-4">
                  This is a demonstration payment. No real money will be charged and no actual payment is processed.
                </p>
                <div className="bg-white p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-gray-600 mb-1">Demo Payment Details:</p>
                  <div className="flex justify-between text-sm">
                    <span>Amount:</span>
                    <span className="font-mono">${(totalAmount / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <span className="text-green-600">✓ Simulated</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg">
              <PaymentElement
                options={{
                  layout: 'tabs',
                }}
              />
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-start space-x-2 p-3 bg-green-50 rounded-lg">
          <ShieldCheckIcon className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="text-sm">
            <p className="text-green-800 font-medium">Secure Payment</p>
            <p className="text-green-700">
              Your payment is processed securely through Stripe. Funds are held in escrow until service completion.
            </p>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-800 space-y-1">
            <div className="flex justify-between">
              <span>Service fee:</span>
              <span>${((totalAmount * 0.85) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (15%):</span>
              <span>${((totalAmount * 0.15) / 100).toFixed(2)}</span>
            </div>
            <div className="border-t border-blue-200 pt-1 font-medium flex justify-between">
              <span>Total:</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={(!stripe || !elements || isProcessing) && !isDemoMode}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-150 flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              {isDemoMode ? 'Simulating Payment...' : 'Processing Payment...'}
            </>
          ) : (
            isDemoMode ? `Simulate Payment ($${(totalAmount / 100).toFixed(2)})` : `Pay $${(totalAmount / 100).toFixed(2)}`
          )}
        </button>
      </form>

      {/* Terms */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        By proceeding with payment, you agree to our{' '}
        <a href="/terms" className="text-rose-500 hover:text-rose-600">Terms of Service</a>{' '}
        and{' '}
        <a href="/privacy" className="text-rose-500 hover:text-rose-600">Privacy Policy</a>.
      </p>
    </div>
  );
}