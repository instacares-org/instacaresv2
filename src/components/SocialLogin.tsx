"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface SocialLoginProps {
  userType: 'parent' | 'caregiver';
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
      // Use NextAuth.js signIn with OAuth provider
      const result = await signIn(provider, {
        redirect: false, // Don't redirect automatically
        callbackUrl: userType === 'parent' ? '/parent-dashboard' : '/caregiver-dashboard'
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

  const FacebookIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );

  const AppleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );

  const LinkedInIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
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

      {/* Google Login */}
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

      {/* Facebook Login */}
      <button
        onClick={() => handleSocialLogin('facebook')}
        disabled={loadingProvider !== null}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition duration-150 disabled:opacity-50"
      >
        {loadingProvider === 'facebook' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
        ) : (
          <>
            <FacebookIcon />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Continue with Facebook
            </span>
          </>
        )}
      </button>

      {/* Apple Login */}
      <button
        onClick={() => handleSocialLogin('apple')}
        disabled={loadingProvider !== null}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition duration-150 disabled:opacity-50"
      >
        {loadingProvider === 'apple' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
        ) : (
          <>
            <AppleIcon />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Continue with Apple
            </span>
          </>
        )}
      </button>

      {/* LinkedIn Login (for caregivers mainly) */}
      {userType === 'caregiver' && (
        <button
          onClick={() => handleSocialLogin('linkedin')}
          disabled={loadingProvider !== null}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition duration-150 disabled:opacity-50"
        >
          {loadingProvider === 'linkedin' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
          ) : (
            <>
              <LinkedInIcon />
              <span className="ml-3 text-sm font-medium text-gray-700">
                Continue with LinkedIn
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}