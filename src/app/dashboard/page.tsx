'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (!session) {
      // Not authenticated, redirect to login
      router.push('/login');
      return;
    }

    // Redirect based on user type
    // Babysitters have userType='CAREGIVER' + isBabysitter=true, so check first
    if ((session.user as any).isBabysitter) {
      router.push('/babysitter-dashboard');
      return;
    }

    switch (session.user.userType) {
      case 'PARENT':
        router.push('/parent-dashboard');
        break;
      case 'CAREGIVER':
        router.push('/caregiver-dashboard');
        break;
      case 'ADMIN':
        router.push('/admin');
        break;
      default:
        router.push('/');
        break;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}