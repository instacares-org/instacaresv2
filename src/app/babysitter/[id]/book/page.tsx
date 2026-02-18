'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
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
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  ShieldCheck
} from 'lucide-react';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_')
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  : Promise.resolve(null);

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

// Stripe Payment Form Component
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
        return_url: `${window.location.origin}/babysitter-dashboard`,
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
    <div className="bg-white rounded-xl border p-6">
      <h2 className="font-semibold text-gray-900 mb-2 flex items-center">
        <ShieldCheck className="w-5 h-5 mr-2 text-[#8B5CF6]" />
        Pay Platform Fee
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Only the platform fee of <strong>${(platformFee / 100).toFixed(2)} CAD</strong> will be charged now.
        You&apos;ll pay the babysitter directly at the end of the session.
      </p>

      <form onSubmit={handlePayment}>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />

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

export default function BookBabysitterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const [babysitter, setBabysitter] = useState<BabysitterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [commissionRate, setCommissionRate] = useState(0.21); // fallback

  // Payment step state
  const [step, setStep] = useState<'form' | 'payment' | 'creating'>('form');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');

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
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/babysitter/${id}/book`);
      return;
    }

    const fetchBabysitter = async () => {
      try {
        const res = await fetch(`/api/babysitter/profile?id=${id}`);
        if (res.ok) {
          const data = await res.json();
          setBabysitter(data);
          if (!data.acceptsOnsitePayment && data.stripeOnboarded) {
            setForm(prev => ({ ...prev, paymentMethod: 'PLATFORM' }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch babysitter:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch commission rate from admin settings
    fetch('/api/platform/commission-rate')
      .then(res => res.json())
      .then(data => {
        if (data.commissionRate) setCommissionRate(data.commissionRate);
      })
      .catch(() => {});

    // Pre-fill address from user profile
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
  }, [id, authLoading, isAuthenticated, router, user]);

  const commissionPercentage = Math.round(commissionRate * 100);

  const calculatePricing = () => {
    if (!babysitter || !form.date || !form.startTime || !form.endTime) {
      return { totalHours: 0, subtotal: 0, platformFee: 0, totalAmount: 0 };
    }

    const startDateTime = new Date(`${form.date}T${form.startTime}`);
    const endDateTime = new Date(`${form.date}T${form.endTime}`);
    let totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);

    // Handle overnight bookings
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
        // Step 1: Create payment intent for platform fee only
        const paymentRes = await fetch('/api/babysitter/booking/create-platform-fee-payment', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            babysitterId: id,
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

        // Show Stripe payment form
        setClientSecret(paymentData.clientSecret);
        setStep('payment');
      } else {
        // PLATFORM payment - direct booking (existing flow)
        const res = await fetch('/api/babysitter/booking', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            babysitterId: id,
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // After Stripe payment succeeds, create the booking
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
          babysitterId: id,
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

      // Success - redirect to parent dashboard
      router.push(`/parent-dashboard?tab=bookings&success=babysitter`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create booking after payment');
      setStep('form');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (!babysitter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Babysitter Not Found</h1>
          <button
            onClick={() => router.push('/find-babysitter')}
            className="px-6 py-3 bg-[#8B5CF6] text-white rounded-lg"
          >
            Browse Babysitters
          </button>
        </main>
      </div>
    );
  }

  // Set min date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // Creating booking after payment
  if (step === 'creating') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#8B5CF6] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Creating your booking...</h2>
          <p className="text-gray-500 mt-2">Payment confirmed. Setting up your booking now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => {
            if (step === 'payment') {
              setStep('form');
              setClientSecret('');
            } else {
              router.back();
            }
          }}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          {step === 'payment' ? 'Back to booking details' : 'Back to profile'}
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Book {babysitter.firstName}</h1>
        <p className="text-gray-600 mb-8">
          {step === 'payment' ? 'Complete payment to confirm your booking' : 'Fill in the details to request a booking'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {step === 'payment' && clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <PlatformFeePaymentForm
                  platformFee={Math.round(pricing.platformFee * 100)}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => { setStep('form'); setClientSecret(''); }}
                />
              </Elements>
            ) : (
              <>
                {/* Date & Time */}
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Date & Time
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        min={minDate}
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                  </div>

                  {pricing.totalHours > 0 && pricing.totalHours < 2 && (
                    <p className="text-red-500 text-sm mt-2">Minimum booking is 2 hours</p>
                  )}
                </div>

                {/* Children */}
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Children
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Children *
                    </label>
                    <select
                      value={form.childrenCount}
                      onChange={(e) => setForm({ ...form, childrenCount: parseInt(e.target.value) })}
                      className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'child' : 'children'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Requests or Notes
                    </label>
                    <textarea
                      value={form.specialRequests}
                      onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                      placeholder="Any allergies, special needs, bedtime routines, etc."
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Location
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apartment/Unit (Optional)
                      </label>
                      <input
                        type="text"
                        value={form.apartment}
                        onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                        <input
                          type="text"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Province *
                        </label>
                        <input
                          type="text"
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code *
                        </label>
                        <input
                          type="text"
                          value={form.zipCode}
                          onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-[#8B5CF6]" />
                    Payment Method
                  </h2>

                  <div className="space-y-3">
                    {babysitter.acceptsOnsitePayment && (
                      <label
                        className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                          form.paymentMethod === 'ONSITE'
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                            : 'border-gray-200 hover:border-gray-300'
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
                            <span className="font-medium text-gray-900">Pay On-Site</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Pay the babysitter directly in cash or e-transfer at the end of the session.
                            A {commissionPercentage}% platform fee (${pricing.platformFee.toFixed(2)}) will be charged now to confirm.
                          </p>
                        </div>
                      </label>
                    )}

                    {babysitter.stripeOnboarded && (
                      <label
                        className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                          form.paymentMethod === 'PLATFORM'
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                            : 'border-gray-200 hover:border-gray-300'
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
                            <span className="font-medium text-gray-900">Pay Through Platform</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Secure payment through InstaCares. Full amount (${pricing.totalAmount.toFixed(2)}) will be charged when the babysitter confirms.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-6 sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-4">Booking Summary</h2>

              {/* Babysitter Info */}
              <div className="flex items-center pb-4 border-b">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                  {babysitter.avatar ? (
                    <img
                      src={babysitter.avatar}
                      alt={babysitter.firstName}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-gray-500">
                      {babysitter.firstName.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {babysitter.firstName} {babysitter.lastName}
                  </p>
                  <p className="text-sm text-gray-500">${babysitter.hourlyRate}/hr</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="py-4 border-b space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>${babysitter.hourlyRate} x {pricing.totalHours} hrs</span>
                  <span>${pricing.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center">
                    Platform fee ({commissionPercentage}%)
                    <Info className="w-4 h-4 ml-1 text-gray-400" />
                  </span>
                  <span>${pricing.platformFee.toFixed(2)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="py-4 border-b">
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Total</span>
                  <span>${pricing.totalAmount.toFixed(2)}</span>
                </div>
                {form.paymentMethod === 'ONSITE' && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm text-[#8B5CF6] font-medium">
                      <span>Charged now (platform fee)</span>
                      <span>${pricing.platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Pay babysitter on-site</span>
                      <span>${pricing.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="py-4 flex items-start text-red-600">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Submit Button (only on form step) */}
              {step === 'form' && (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || pricing.totalHours < 2}
                    className="w-full mt-4 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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

                  <p className="text-xs text-gray-500 text-center mt-4">
                    By booking, you agree to our Terms of Service and Cancellation Policy.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
