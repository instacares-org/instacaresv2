'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    // Redirect to appropriate dashboard based on user type
    if (session.user.userType === 'PARENT') {
      router.push('/parent-dashboard?tab=bookings');
    } else if (session.user.userType === 'BABYSITTER') {
      router.push('/babysitter-dashboard');
    } else if (session.user.userType === 'CAREGIVER') {
      router.push('/caregiver-dashboard?tab=bookings');
    } else {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Loading your bookings...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
}
