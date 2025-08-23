import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

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