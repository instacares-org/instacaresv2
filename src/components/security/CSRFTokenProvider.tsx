'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface CSRFTokenContextType {
  token: string | null;
  loading: boolean;
  refreshToken: () => Promise<void>;
}

const CSRFTokenContext = createContext<CSRFTokenContextType | undefined>(undefined);

// Helper function to get CSRF token from cookies
function getCSRFTokenFromCookie(): string | null {
  if (typeof window === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie => 
    cookie.trim().startsWith('csrf-token=')
  );
  
  if (csrfCookie) {
    const rawToken = csrfCookie.split('=')[1];
    // Don't decode here - send the raw URL-encoded token to match the cookie
    return rawToken;
  }
  
  return null;
}

// Helper function to fetch a new CSRF token
async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.token || null;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
  
  return null;
}

interface CSRFTokenProviderProps {
  children: ReactNode;
}

export function CSRFTokenProvider({ children }: CSRFTokenProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshToken = async () => {
    setLoading(true);
    
    // First try to get token from cookie
    let csrfToken = getCSRFTokenFromCookie();
    
    // If not found in cookie, fetch from server
    if (!csrfToken) {
      csrfToken = await fetchCSRFToken();
    }
    
    setToken(csrfToken);
    setLoading(false);
  };

  useEffect(() => {
    refreshToken();
  }, []);

  const contextValue: CSRFTokenContextType = {
    token,
    loading,
    refreshToken,
  };

  return (
    <CSRFTokenContext.Provider value={contextValue}>
      {children}
    </CSRFTokenContext.Provider>
  );
}

// Hook to use CSRF token
export function useCSRFToken(): CSRFTokenContextType {
  const context = useContext(CSRFTokenContext);
  if (context === undefined) {
    throw new Error('useCSRFToken must be used within a CSRFTokenProvider');
  }
  return context;
}

// HOC to add CSRF protection to forms
interface CSRFProtectedFormProps {
  children: ReactNode;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  [key: string]: any;
}

export function CSRFProtectedForm({ 
  children, 
  onSubmit, 
  className,
  ...props 
}: CSRFProtectedFormProps) {
  const { token, loading } = useCSRFToken();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (loading || !token) {
      event.preventDefault();
      console.error('CSRF token not available');
      return;
    }
    
    onSubmit(event);
  };

  return (
    <form onSubmit={handleSubmit} className={className} {...props}>
      {token && (
        <input 
          type="hidden" 
          name="csrf_token" 
          value={token}
        />
      )}
      {children}
    </form>
  );
}

// Utility function to add CSRF headers to fetch requests
export function addCSRFHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFTokenFromCookie();
  
  // Debug CSRF token being sent
  console.log('Adding CSRF Headers:', {
    token: token?.substring(0, 30) + '...',
    tokenLength: token?.length,
    hasToken: !!token
  });
  
  if (token) {
    return {
      ...headers,
      'x-csrf-token': token,
    };
  }
  
  return headers;
}

// Enhanced fetch function with CSRF protection
export async function csrfFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const token = getCSRFTokenFromCookie();
  
  if (!token) {
    throw new Error('CSRF token not available. Please refresh the page.');
  }

  const enhancedOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
      ...options.headers,
    },
  };

  const response = await fetch(url, enhancedOptions);
  
  // If CSRF error, try to refresh token and retry once
  if (response.status === 403 && 
      (await response.clone().json()).error?.toLowerCase().includes('csrf')) {
    
    // Try to get a new token
    const newToken = await fetchCSRFToken();
    if (newToken) {
      enhancedOptions.headers = {
        ...enhancedOptions.headers,
        'X-CSRF-Token': newToken,
      };
      
      return fetch(url, enhancedOptions);
    }
  }
  
  return response;
}

// Component to display CSRF token status (for debugging)
export function CSRFTokenStatus() {
  const { token, loading } = useCSRFToken();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded text-xs font-mono">
      <div>CSRF: {loading ? 'Loading...' : token ? 'OK' : 'Missing'}</div>
      {token && <div>Token: {token.substring(0, 8)}...</div>}
    </div>
  );
}