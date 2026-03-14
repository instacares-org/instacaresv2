"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface SocialLoginProps {
  userType: 'parent' | 'caregiver' | 'babysitter';
  onSocialLogin?: (provider: string, userType: string) => void;
}

export default function SocialLogin({ userType, onSocialLogin }: SocialLoginProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check if we're in development mode with test credentials
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasTestCredentials = 
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.includes('1234567890') ||
    process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID?.includes('1234567890');

  const handleSocialLogin = async (provider: string) => {
    console.log('SocialLogin: handleSocialLogin called with:', { provider, userType });
    setLoadingProvider(provider);
    setErrorMessage('');

    // In development with test credentials, show a helpful message
    if (isDevelopment && hasTestCredentials) {
      setTimeout(() => {
        setLoadingProvider(null);
        setErrorMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured with real credentials. Please set up actual OAuth credentials in your .env file to test social login.`);
      }, 1000);
      return;
    }

    try {
      // Store the user type in localStorage BEFORE initiating OAuth
      // This ensures we know what type of user is signing up even if callbackUrl is lost
      localStorage.setItem('oauthSignupUserType', userType);
      localStorage.setItem('oauthSignupTimestamp', Date.now().toString());
      console.log('SocialLogin: Stored oauthSignupUserType in localStorage:', userType);

      // Use NextAuth.js signIn with OAuth provider
      // Redirect to appropriate dashboard based on user type where profile completion modal will show
      // Pass userType in callback URL so the system knows if this is a caregiver signup
      const callbackUrl = userType === 'babysitter'
        ? '/babysitter-dashboard?oauth=true&userType=babysitter'
        : userType === 'caregiver'
        ? '/caregiver-dashboard?oauth=true&userType=caregiver'
        : '/parent-dashboard?oauth=true&userType=parent';

      const result = await signIn(provider, {
        redirect: true, // Let OAuth handle the redirect
        callbackUrl // Go to dashboard where profile completion modal will show
      });
      
      if (result?.error) {
        console.error('OAuth sign in error:', result.error);
        setErrorMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in failed. Please try again.`);
      } else if (result?.ok) {
        // Success - call the callback if provided
        onSocialLogin?.(provider, userType);
      }
    } catch (error) {
      console.error('OAuth sign in failed:', error);
      setErrorMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in encountered an error. Please try again.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="space-y-3">
      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg text-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p>{errorMessage}</p>
              {isDevelopment && (
                <p className="mt-1 text-orange-600">
                  <strong>Development Note:</strong> Set up real OAuth credentials to enable social login functionality.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Login - Only active provider */}
      <button
        onClick={() => handleSocialLogin('google')}
        disabled={loadingProvider !== null}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition duration-150 disabled:opacity-50"
      >
        {loadingProvider === 'google' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
        ) : (
          <>
            <GoogleIcon />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Continue with Google
            </span>
          </>
        )}
      </button>

      {/* Facebook, Apple, and LinkedIn login disabled - may be enabled in future */}
    </div>
  );
}
