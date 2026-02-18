// Payment mode configuration
export type PaymentMode = 'demo' | 'test' | 'live';

export const PAYMENT_MODE: PaymentMode = (process.env.PAYMENT_MODE as PaymentMode) || 'demo';

export const paymentConfig = {
  demo: {
    name: 'Demo Mode',
    description: 'Simulated payments for development testing',
    allowRealMoney: false,
    stripeMode: 'test',
    showWarnings: true,
    color: 'yellow'
  },
  test: {
    name: 'Test Mode', 
    description: 'Real Stripe test mode - no real money',
    allowRealMoney: false,
    stripeMode: 'test',
    showWarnings: true,
    color: 'blue'
  },
  live: {
    name: 'Live Mode',
    description: 'Real payments with real money',
    allowRealMoney: true,
    stripeMode: 'live',
    showWarnings: false,
    color: 'green'
  }
};

export const getCurrentConfig = () => paymentConfig[PAYMENT_MODE];

export const isRealMoneyMode = () => PAYMENT_MODE === 'live';
export const isDemoMode = () => PAYMENT_MODE === 'demo';
export const isTestMode = () => PAYMENT_MODE === 'test';

// Stripe configuration based on mode
export const getStripeConfig = () => {
  const config = getCurrentConfig();
  
  return {
    publishableKey: config.stripeMode === 'live' 
      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE
      : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: config.stripeMode === 'live'
      ? process.env.STRIPE_SECRET_KEY_LIVE  
      : process.env.STRIPE_SECRET_KEY,
    webhookSecret: config.stripeMode === 'live'
      ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
      : process.env.STRIPE_WEBHOOK_SECRET
  };
};

// Payment amount handling based on mode
export const processPaymentAmount = (amount: number): number => {
  if (isDemoMode()) {
    // Demo mode: Use $1 test amounts
    return 100; // $1.00 in cents
  }
  
  if (isTestMode()) {
    // Test mode: Use real amounts but with test cards
    return amount;
  }
  
  // Live mode: Use real amounts
  return amount;
};

// Warning messages for non-live modes
export const getPaymentModeWarning = (): string | null => {
  const config = getCurrentConfig();
  
  if (!config.showWarnings) return null;
  
  if (isDemoMode()) {
    return '⚠️ Demo Mode: Payments are simulated. No real money will be charged.';
  }
  
  if (isTestMode()) {
    return '🧪 Test Mode: Using Stripe test mode. Use test card numbers only.';
  }
  
  return null;
};