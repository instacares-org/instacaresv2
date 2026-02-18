"use client";

import { useEffect, useState, ReactNode } from 'react';

interface NoHydrationWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * NoHydrationWrapper prevents hydration mismatches by only rendering
 * the children on the client side after the component has mounted.
 * This is useful for components that are affected by browser extensions
 * like DarkReader that modify the DOM after hydration.
 */
export default function NoHydrationWrapper({ 
  children, 
  fallback 
}: NoHydrationWrapperProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback || null;
  }

  return <>{children}</>;
}