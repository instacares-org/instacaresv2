"use client";

import { Suspense } from 'react';

interface SearchParamsWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function SearchParamsWrapper({ 
  children, 
  fallback = <div>Loading...</div> 
}: SearchParamsWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}