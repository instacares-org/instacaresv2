"use client";

import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  children: ReactNode;
  retry?: () => void;
  retryText?: string;
}

const ApiErrorFallback: React.FC<{ retry?: () => void; retryText?: string }> = ({ 
  retry, 
  retryText = "Try Again" 
}) => (
  <div className="text-center py-12">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
      <svg
        className="h-6 w-6 text-yellow-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <h3 className="mt-2 text-sm font-medium text-gray-900">
      Unable to load data
    </h3>
    <p className="mt-1 text-sm text-gray-500">
      There was a problem loading the content. Please try again.
    </p>
    {retry && (
      <div className="mt-6">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {retryText}
        </button>
      </div>
    )}
  </div>
);

export default function ApiErrorBoundary({ children, retry, retryText }: Props) {
  return (
    <ErrorBoundary fallback={<ApiErrorFallback retry={retry} retryText={retryText} />}>
      {children}
    </ErrorBoundary>
  );
}