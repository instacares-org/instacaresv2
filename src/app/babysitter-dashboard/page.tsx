'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BabysitterDashboard from '@/components/BabysitterDashboard';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import { Loader2 } from 'lucide-react';

function BabysitterDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading, refreshUser } = useAuth();

  // OAuth profile completion modal state
  const [showOAuthCompletionModal, setShowOAuthCompletionModal] = useState(false);
  const [profileCompletedInSession, setProfileCompletedInSession] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/babysitter-dashboard');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Show profile completion modal when babysitter needs to complete their profile
  useEffect(() => {
    const isOAuthCallback = searchParams.get('oauth') === 'true';

    // Clean up URL parameters after detecting OAuth callback
    if (isOAuthCallback) {
      window.history.replaceState({}, '', '/babysitter-dashboard');
    }

    // Show modal if user needs profile completion
    const shouldShowModal = isAuthenticated &&
      user?.needsProfileCompletion === true &&
      !profileCompletedInSession &&
      !showOAuthCompletionModal;

    if (shouldShowModal) {
      setShowOAuthCompletionModal(true);
    }
  }, [isAuthenticated, user?.needsProfileCompletion, user?.id, profileCompletedInSession, showOAuthCompletionModal, searchParams]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <BabysitterDashboard />

      {/* OAuth Profile Completion Modal for Babysitters */}
      {showOAuthCompletionModal && user && (
        <ProfileCompletionModal
          isOpen={showOAuthCompletionModal}
          onClose={() => setShowOAuthCompletionModal(false)}
          onComplete={async () => {
            document.cookie = 'oauthIntendedUserType=;path=/;max-age=0';
            localStorage.removeItem('oauthSignupUserType');
            localStorage.removeItem('oauthSignupTimestamp');
            await refreshUser();
            setProfileCompletedInSession(true);
            setShowOAuthCompletionModal(false);
          }}
        />
      )}
    </>
  );
}

export default function BabysitterDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    }>
      <BabysitterDashboardContent />
    </Suspense>
  );
}
