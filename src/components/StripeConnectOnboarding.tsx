'use client';

import { useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { addCSRFHeader } from '@/lib/csrf';

interface StripeConnectOnboardingProps {
  stripeAccountId: string;
  onExit: () => void;
  onError?: (error: any) => void;
}

export default function StripeConnectOnboarding({
  stripeAccountId,
  onExit,
  onError,
}: StripeConnectOnboardingProps) {
  const [connectInstance] = useState(() => {
    const fetchClientSecret = async () => {
      const response = await fetch('/api/stripe/connect/account-session', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ accountId: stripeAccountId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to fetch client secret' }));
        throw new Error(err.error || 'Failed to fetch client secret');
      }
      const json = await response.json();
      const clientSecret = json.data?.clientSecret ?? json.clientSecret;
      if (!clientSecret) {
        throw new Error('No client secret in response');
      }
      return clientSecret;
    };

    return loadConnectAndInitialize({
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      fetchClientSecret,
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#16a34a',
        },
      },
    });
  });

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <ConnectAccountOnboarding
        onExit={onExit}
      />
    </ConnectComponentsProvider>
  );
}
