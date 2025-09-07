import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Server-side Stripe instance with build-time safety
let stripeInstance: Stripe | null = null;

export const getStripeInstance = (): Stripe | null => {
  // Return cached instance if available
  if (stripeInstance !== null) {
    return stripeInstance;
  }
  
  const apiKey = process.env.STRIPE_SECRET_KEY;
  
  // During build, return null to prevent initialization errors
  const isBuildTime = process.env.SKIP_ENV_VALIDATION === 'true' || 
                      process.env.NEXT_PHASE === 'phase-production-build';
  
  if (isBuildTime) {
    return null;
  }
  
  // Check if we have a valid API key
  if (!apiKey || apiKey.includes('sk_test_your_stripe') || apiKey === 'test') {
    console.warn('Stripe API key not configured properly, using demo mode');
    return null;
  }
  
  // Create and cache the instance
  stripeInstance = new Stripe(apiKey, {
    apiVersion: '2024-06-20',
  });
  
  return stripeInstance;
};

// Export for backwards compatibility
export const stripe = getStripeInstance();

// Client-side Stripe instance
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Platform configuration
export const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');

// Utility to calculate commission
export const calculateCommission = (amount: number): number => {
  return Math.round(amount * PLATFORM_COMMISSION_RATE);
};

// Utility to calculate caregiver payout
export const calculateCaregiverPayout = (amount: number): number => {
  return amount - calculateCommission(amount);
};