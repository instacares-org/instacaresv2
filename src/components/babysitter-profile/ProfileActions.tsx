'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, ChevronLeft } from 'lucide-react';

interface ProfileActionsProps {
  babysitterId: string;
  babysitterFirstName: string;
  isAvailable: boolean;
}

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
    >
      <ChevronLeft className="w-5 h-5 mr-1" />
      Back to search
    </button>
  );
}

export function FavoriteButton() {
  const [isFavorite, setIsFavorite] = useState(false);
  return (
    <button
      onClick={() => setIsFavorite(!isFavorite)}
      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
    >
      <Heart
        className={`w-6 h-6 ${
          isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
        }`}
      />
    </button>
  );
}

export function BookNowButton({ babysitterId, isAvailable, variant = 'primary' }: {
  babysitterId: string;
  isAvailable: boolean;
  variant?: 'primary' | 'cta';
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleBookNow = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/babysitter/${babysitterId}`);
      return;
    }
    router.push(`/babysitter/${babysitterId}/book`);
  };

  if (variant === 'cta') {
    return (
      <button
        onClick={handleBookNow}
        disabled={!isAvailable}
        className="w-full py-3 bg-white text-[#8B5CF6] rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {isAvailable ? 'Request Booking' : 'Unavailable'}
      </button>
    );
  }

  return (
    <button
      onClick={handleBookNow}
      disabled={!isAvailable}
      className="flex-1 sm:flex-none px-8 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAvailable ? 'Book Now' : 'Currently Unavailable'}
    </button>
  );
}

export function NotFoundActions() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/find-babysitter')}
      className="px-6 py-3 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
    >
      Browse Babysitters
    </button>
  );
}
