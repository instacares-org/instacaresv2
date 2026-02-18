"use client";

import { ReactNode } from 'react';

interface HydrationBoundaryProps {
  children: ReactNode;
}

/**
 * HydrationBoundary is a wrapper that prevents hydration warnings
 * caused by browser extensions that modify DOM attributes.
 * 
 * This is specifically useful for handling DarkReader and similar
 * extensions that add data-* attributes after React hydrates.
 */
export default function HydrationBoundary({ children }: HydrationBoundaryProps) {
  return (
    <div suppressHydrationWarning>
      {children}
    </div>
  );
}