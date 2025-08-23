'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface TipButtonProps {
  bookingId: string;
  caregiverName: string;
  onSuccess?: () => void;
}

function TipButtonContent({ bookingId, caregiverName, onSuccess }: TipButtonProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const tipOptions = [5, 10, 15, 20];

  const handleTipSubmit = async () => {
    if (!stripe || !elements || !tipAmount) return;

    setProcessing(true);
    
    try {
      // Create tip payment
      const response = await fetch('/api/payments/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          tipAmount: tipAmount * 100, // Convert to cents
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process tip');
      }

      // Confirm payment
      const result = await stripe.confirmCardPayment(data.paymentIntent.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setSuccess(true);
      setTimeout(() => {
        setShowTipModal(false);
        setSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowTipModal(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        💝 Add Tip
      </button>

      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            {success ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-green-600">Thank You!</h3>
                <p className="text-gray-600 mt-2">Your tip has been sent to {caregiverName}</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Add a Tip for {caregiverName}</h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {tipOptions.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setTipAmount(amount);
                          setCustomAmount('');
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          tipAmount === amount
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">Custom:</span>
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="Enter amount"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setTipAmount(parseFloat(e.target.value) || null);
                        }}
                        className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {tipAmount && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-800">
                        Tip Amount: <span className="font-semibold">${tipAmount.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        100% of your tip goes directly to {caregiverName}
                      </p>
                    </div>
                  )}

                  <div className="border rounded-lg p-3">
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: '16px',
                            color: '#424770',
                            '::placeholder': { color: '#aab7c4' },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowTipModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTipSubmit}
                    disabled={!stripe || !tipAmount || processing}
                    className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                      !stripe || !tipAmount || processing
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {processing ? 'Processing...' : `Send $${tipAmount?.toFixed(2) || '0'} Tip`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function TipButton(props: TipButtonProps) {
  return (
    <Elements stripe={stripePromise}>
      <TipButtonContent {...props} />
    </Elements>
  );
}