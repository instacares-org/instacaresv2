"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CaregiverLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the correct caregiver login route
    router.replace('/login/caregiver');
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to caregiver login...</p>
      </div>
    </div>
  );
}