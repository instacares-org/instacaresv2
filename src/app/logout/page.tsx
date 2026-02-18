'use client';

import { useEffect, Suspense } from 'react';
import { signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LogoutContent() {
  const searchParams = useSearchParams();
  const isAdmin = searchParams?.get('admin') === 'true';

  useEffect(() => {
    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });

    // Sign out with NextAuth
    signOut({ 
      callbackUrl: isAdmin ? '/login/admin' : '/login',
      redirect: true 
    });
  }, [isAdmin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Logging out...</h1>
        <p className="text-gray-600">Please wait while we clear your session.</p>
        <div className="mt-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Logging out...</h1>
          <div className="mt-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    }>
      <LogoutContent />
    </Suspense>
  );
}
