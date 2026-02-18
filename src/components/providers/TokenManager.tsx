'use client';

import { useEffect } from 'react';
import { tokenManager } from '@/lib/token-manager';

/**
 * Token Manager Component
 * Initializes automatic token refresh system
 */
export default function TokenManager() {
  useEffect(() => {
    // Start the token manager
    tokenManager.start();

    // Cleanup on unmount
    return () => {
      tokenManager.stop();
    };
  }, []);

  // This component renders nothing but provides the token management functionality
  return null;
}