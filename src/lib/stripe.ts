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
    apiVersion: '2025-08-27.basil' as any,
  });
  
  return stripeInstance;
};

// Export for backwards compatibility
export const stripe = getStripeInstance();

// Client-side Stripe instance (uses @stripe/stripe-js types, not server-side Stripe)
let stripePromise: ReturnType<typeof loadStripe>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Platform configuration - default fallback (database value takes precedence)
export const DEFAULT_COMMISSION_RATE = 0.21; // 21% default

// Cache for platform settings to avoid repeated DB calls
let cachedCommissionRate: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Fetch commission rate from database
export const getCommissionRate = async (): Promise<number> => {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedCommissionRate !== null && now - cacheTimestamp < CACHE_DURATION) {
    return cachedCommissionRate;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('@/lib/database');
    const settings = await prisma.platformSettings.findFirst();

    if (settings && settings.platformCommissionRate !== null) {
      cachedCommissionRate = settings.platformCommissionRate / 100; // Convert from percentage to decimal
      cacheTimestamp = now;
      return cachedCommissionRate;
    }
  } catch (error) {
    console.error('Failed to fetch platform commission rate from database:', error);
  }

  // Fallback to default
  return DEFAULT_COMMISSION_RATE;
};

// Synchronous version for backwards compatibility (uses cached or default)
export const PLATFORM_COMMISSION_RATE = DEFAULT_COMMISSION_RATE;

// Utility to calculate commission (async version - preferred)
export const calculateCommissionAsync = async (amount: number): Promise<number> => {
  const rate = await getCommissionRate();
  return Math.round(amount * rate);
};

// Utility to calculate commission (sync version - uses default or cached)
export const calculateCommission = (amount: number): number => {
  const rate = cachedCommissionRate ?? DEFAULT_COMMISSION_RATE;
  return Math.round(amount * rate);
};

// Utility to calculate caregiver payout (async version - preferred)
export const calculateCaregiverPayoutAsync = async (amount: number): Promise<number> => {
  const commission = await calculateCommissionAsync(amount);
  return amount - commission;
};

// Utility to calculate caregiver payout (sync version)
export const calculateCaregiverPayout = (amount: number): number => {
  return amount - calculateCommission(amount);
};