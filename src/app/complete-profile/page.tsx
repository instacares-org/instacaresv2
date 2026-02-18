"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';

export default function CompleteProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessionCheckAttempts, setSessionCheckAttempts] = useState(0);
  const maxSessionCheckAttempts = 10; // Will check for ~5 seconds (500ms * 10)

  // Wait for session to be established after OAuth callback
  // This handles the race condition where session isn't immediately available
  useEffect(() => {
    // If we have a session, we're good - no need to keep checking
    if (status === 'authenticated') {
      return;
    }

    // If still loading, wait for it
    if (status === 'loading') {
      return;
    }

    // If unauthenticated, we might be in the middle of OAuth callback
    // Keep checking for a few seconds before giving up
    if (status === 'unauthenticated' && sessionCheckAttempts < maxSessionCheckAttempts) {
      const timer = setTimeout(() => {
        setSessionCheckAttempts(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }

    // If we've checked multiple times and still no session, redirect to home
    if (status === 'unauthenticated' && sessionCheckAttempts >= maxSessionCheckAttempts) {
      router.push('/');
    }
  }, [status, sessionCheckAttempts, router]);

  // Show loading spinner while session is loading or still checking for session
  const isLoading = status === 'loading' ||
    (status === 'unauthenticated' && sessionCheckAttempts < maxSessionCheckAttempts);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  // If not authenticated after all checks, don't render
  if (status !== 'authenticated') {
    return null;
  }

  // Render the modal
  return (
    <ProfileCompletionModal
      isOpen={true}
      onClose={() => router.push('/')}
      onComplete={() => router.push('/parent-dashboard')}
    />
  );
}
