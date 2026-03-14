'use client';

import { useState, useEffect } from 'react';
import type { Appearance } from '@stripe/stripe-js';

/**
 * Hook that returns a Stripe Elements Appearance object that automatically
 * switches between 'stripe' (light) and 'night' (dark) themes based on
 * Tailwind's class-based dark mode (the `dark` class on <html>).
 *
 * It observes mutations on `document.documentElement` so theme changes are
 * picked up in real time without a page reload.
 */
export function useStripeAppearance(): Appearance {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () =>
      setIsDark(document.documentElement.classList.contains('dark'));

    // Initial check
    checkDark();

    // Watch for class changes on <html> (Tailwind toggles the 'dark' class)
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return { theme: isDark ? 'night' : 'stripe' };
}
