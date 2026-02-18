'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { addCSRFHeader } from '@/lib/csrf';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  CreditCard,
  Banknote,
  AlertCircle,
  Loader2,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_')
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  : Promise.resolve(null);

interface BookBabysitterModalProps {
  babysitterId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface BabysitterProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  hourlyRate: number;
  acceptsOnsitePayment: boolean;
  stripeOnboarded: boolean;
}

interface BookingForm {
  date: string;
  startTime: string;
  endTime: string;
  childrenCount: number;
  specialRequests: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: 'ONSITE' | 'PLATFORM';
}

function PlatformFeePaymentForm({
  platformFee,
  onSuccess,
  onBack,
}: {
  platformFee: number;
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/parent-dashboard`,
      },
    });

    if (error) {
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-2 flex items-center">
        <ShieldCheck className="w-5 h-5 mr-2 text-[#8B5CF6]" />
        Pay Platform Fee
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Only the platform fee of <strong>${(platformFee / 100).toFixed(2)} CAD</strong> will be charged now.
        You&apos;ll pay the babysitter directly at the end of the session.
      </p>

      <form onSubmit={handlePayment}>
        <PaymentElement options={{ layout: 'tabs' }} />

        {paymentError && (
          <div className="mt-4 flex items-start text-red-600">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{paymentError}</span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${(platformFee / 100).toFixed(2)} CAD`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BookBabysitterModal({ babysitterId, isOpen, onClose }: BookBabysitterModalProps) {
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const [babysitter, setBabysitter] = useState<BabysitterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [commissionRate, setCommissionRate] = useState(0.21);

  const [step, setStep] = useState<'form' | 'payment' | 'creating'>('form');
  const [clientSecret, setClientSecret] = useState('');

  const [form, setForm] = useState<BookingForm>({
    date: '',
    startTime: '',
    endTime: '',
    childrenCount: 1,
    specialRequests: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'ONSITE',
  });

  useEffect(() => {
    if (!isOpen) return;

    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/find-babysitter`);
      onClose();
      return;
    }

    const fetchBabysitter = async () => {
      try {
        const res = await fetch(`/api/babysitter/profile?id=${babysitterId}`);
        if (res.ok) {
          const data = await res.json();
          setBabysitter(data);
          if (!data.acceptsOnsitePayment && data.stripeOnboarded) {
            setForm(prev => ({ ...prev, paymentMethod: 'PLATFORM' }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch babysitter:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetch('/api/platform/commission-rate')
      .then(res => res.json())
      .then(data => {
        if (data.commissionRate) setCommissionRate(data.commissionRate);
      })
      .catch(() => {});

    if (user?.profile) {
      setForm(prev => ({
        ...prev,
        address: user.profile?.streetAddress || '',
        apartment: user.profile?.apartment || '',
        city: user.profile?.city || '',
        state: user.profile?.state || '',
        zipCode: user.profile?.zipCode || '',
      }));
    }

    fetchBabysitter();
  }, [isOpen, babysitterId, authLoading, isAuthenticated, router, user, onClose]);

  const commissionPercentage = Math.round(commissionRate * 100);

  const calculatePricing = () => {
    if (!babysitter || !form.date || !form.startTime || !form.endTime) {
      return { totalHours: 0, subtotal: 0, platformFee: 0, totalAmount: 0 };
    }

    const startDateTime = new Date(`${form.date}T${form.startTime}`);
    const endDateTime = new Date(`${form.date}T${form.endTime}`);
    let totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    if (totalHours <= 0) {
      totalHours += 24;
    }

    const subtotal = babysitter.hourlyRate * totalHours;
    const platformFee = subtotal * commissionRate;
    const totalAmount = subtotal + platformFee;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  };

  const pricing = calculatePricing();

  const validateForm = (): string | null => {
    if (!form.date) return 'Please select a date';
    if (!form.startTime) return 'Please select a start time';
    if (!form.endTime) return 'Please select an end time';
    if (pricing.totalHours < 2) return 'Minimum booking is 2 hours';
    if (form.childrenCount < 1) return 'Please specify number of children';
    if (!form.address) return 'Please enter your address';
    if (!form.city) return 'Please enter your city';
    if (!form.state) return 'Please enter your state/province';
    if (!form.zipCode) return 'Please enter your postal code';

    const bookingDate = new Date(`${form.date}T${form.startTime}`);
    if (bookingDate <= new Date()) {
      return 'Booking must be in the future';
    }

    return null;
  };

  const getBookingDates = () => {
    const startDateTime = new Date(`${form.date}T${form.startTime}`);
    let endDateTime = new Date(`${form.date}T${form.endTime}`);
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }
    return { startDateTime, endDateTime };
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { startDateTime, endDateTime } = getBookingDates();

      if (form.paymentMethod === 'ONSITE') {
        const paymentRes = await fetch('/api/babysitter/booking/create-platform-fee-payment', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            babysitterId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            childrenCount: form.childrenCount,
            specialRequests: form.specialRequests || undefined,
            address: form.address,
            apartment: form.apartment || undefined,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
          }),
        });

        const paymentData = await paymentRes.json();

        if (!paymentRes.ok) {
          throw new Error(paymentData.error || 'Failed to create payment');
        }

        setClientSecret(paymentData.clientSecret);
        setStep('payment');
      } else {
        const res = await fetch('/api/babysitter/booking', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            babysitterId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            childrenCount: form.childrenCount,
            specialRequests: form.specialRequests || undefined,
            address: form.address,
            apartment: form.apartment || undefined,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            paymentMethod: form.paymentMethod,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create booking');
        router.push(`/parent-dashboard?tab=bookings&success=babysitter`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (completedPaymentIntentId: string) => {
    setStep('creating');
    setError('');

    try {
      const { startDateTime, endDateTime } = getBookingDates();

      const res = await fetch('/api/babysitter/booking', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          babysitterId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          childrenCount: form.childrenCount,
          specialRequests: form.specialRequests || undefined,
          address: form.address,
          apartment: form.apartment || undefined,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          paymentMethod: 'ONSITE',
          paymentIntentId: completedPaymentIntentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create booking');

      router.push(`/parent-dashboard?tab=bookings&success=babysitter`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking after payment');
      setStep('form');
    }
  };

  if (!isOpen) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={step === 'form' ? onClose : undefined} />

        <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full mx-auto shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isLoading ? 'Loading...' : babysitter ? `Book ${babysitter.firstName}` : 'Babysitter Not Found'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {step === 'payment' ? 'Complete payment to confirm' : step === 'creating' ? 'Creating booking...' : 'Fill in the details'}
              </p>
            </div>
            {step === 'form' && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="p-6">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
              </div>
            )}

            {/* Not found */}
            {!isLoading && !babysitter && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Babysitter not found.</p>
                <button onClick={onClose} className="mt-4 px-6 py-2 bg-[#8B5CF6] text-white rounded-lg">
                  Close
                </button>
              </div>
            )}

            {/* Creating step */}
            {step === 'creating' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-[#8B5CF6] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Creating your booking...</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Payment confirmed. Setting up your booking now.</p>
              </div>
            )}

            {/* Payment step */}
            {step === 'payment' && clientSecret && babysitter && (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <PlatformFeePaymentForm
                  platformFee={Math.round(pricing.platformFee * 100)}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => { setStep('form'); setClientSecret(''); }}
                />
              </Elements>
            )}

            {/* Form step */}
            {step === 'form' && !isLoading && babysitter && (
              <div className="space-y-6">
                {/* Date & Time */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Date & Time
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                      <input
                        type="date"
                        min={minDate}
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time *</label>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time *</label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                  </div>
                  {pricing.totalHours > 0 && pricing.totalHours < 2 && (
                    <p className="text-red-500 text-sm mt-2">Minimum booking is 2 hours</p>
                  )}
                </div>

                {/* Children */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Children
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Children *</label>
                    <select
                      value={form.childrenCount}
                      onChange={(e) => setForm({ ...form, childrenCount: parseInt(e.target.value) })}
                      className="w-full md:w-48 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'child' : 'children'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Requests or Notes</label>
                    <textarea
                      value={form.specialRequests}
                      onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                      placeholder="Allergies, special needs, bedtime routines, etc."
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Location
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Street Address *</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apartment/Unit (Optional)</label>
                      <input
                        type="text"
                        value={form.apartment}
                        onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                        placeholder="Apt 4B"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City *</label>
                        <input
                          type="text"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Province *</label>
                        <input
                          type="text"
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Postal Code *</label>
                        <input
                          type="text"
                          value={form.zipCode}
                          onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Payment Method
                  </h3>
                  <div className="space-y-3">
                    {babysitter.acceptsOnsitePayment && (
                      <label
                        className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                          form.paymentMethod === 'ONSITE'
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="ONSITE"
                          checked={form.paymentMethod === 'ONSITE'}
                          onChange={() => setForm({ ...form, paymentMethod: 'ONSITE' })}
                          className="mt-1 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <div className="ml-3">
                          <div className="flex items-center">
                            <Banknote className="w-5 h-5 mr-2 text-green-600" />
                            <span className="font-medium text-gray-900 dark:text-white">Pay On-Site</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Pay the babysitter directly. A {commissionPercentage}% platform fee (${pricing.platformFee.toFixed(2)}) will be charged now.
                          </p>
                        </div>
                      </label>
                    )}

                    {babysitter.stripeOnboarded && (
                      <label
                        className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                          form.paymentMethod === 'PLATFORM'
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="PLATFORM"
                          checked={form.paymentMethod === 'PLATFORM'}
                          onChange={() => setForm({ ...form, paymentMethod: 'PLATFORM' })}
                          className="mt-1 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <div className="ml-3">
                          <div className="flex items-center">
                            <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                            <span className="font-medium text-gray-900 dark:text-white">Pay Through Platform</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Secure payment through InstaCares. Full amount (${pricing.totalAmount.toFixed(2)}) charged when confirmed.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Pricing Summary */}
                {pricing.totalHours >= 2 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Pricing Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>${babysitter.hourlyRate}/hr x {pricing.totalHours} hrs</span>
                        <span>${pricing.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span className="flex items-center">
                          Platform fee ({commissionPercentage}%)
                          <Info className="w-3.5 h-3.5 ml-1 text-gray-400" />
                        </span>
                        <span>${pricing.platformFee.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between text-base font-semibold text-gray-900 dark:text-white">
                        <span>Total</span>
                        <span>${pricing.totalAmount.toFixed(2)} CAD</span>
                      </div>
                      {form.paymentMethod === 'ONSITE' && (
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-2 space-y-1">
                          <div className="flex justify-between text-[#8B5CF6] font-medium">
                            <span>Charged now (platform fee)</span>
                            <span>${pricing.platformFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-600 font-medium">
                            <span>Pay babysitter on-site</span>
                            <span>${pricing.subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || pricing.totalHours < 2}
                  className="w-full py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {form.paymentMethod === 'ONSITE' ? 'Setting up payment...' : 'Submitting...'}
                    </>
                  ) : form.paymentMethod === 'ONSITE' ? (
                    `Continue to Payment ($${pricing.platformFee.toFixed(2)})`
                  ) : (
                    'Request Booking'
                  )}
                </button>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  By booking, you agree to our Terms of Service and Cancellation Policy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
