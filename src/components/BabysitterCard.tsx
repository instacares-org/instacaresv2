"use client";

import { HeartIcon, MapPinIcon, ClockIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useState, memo, useMemo } from "react";
import CaregiverProfileImage from "./CaregiverProfileImage";
import BabysitterDetailModal from "./BabysitterDetailModal";
import BookBabysitterModal from "./BookBabysitterModal";

export interface BabysitterCardData {
  id: string;
  type: 'babysitter';
  firstName: string;
  lastName: string;
  avatar: string | null;
  city: string;
  state: string;
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  averageRating: number | null;
  reviewCount: number;
  trustBadges: string[];
  acceptsOnsitePayment: boolean;
  stripeOnboarded: boolean;
  availability: Array<{
    recurrenceType?: string;
    day: string | null;
    dayOfWeek?: number | null;
    startTime: string;
    endTime: string;
    specificDate?: string | null;
    dayOfMonth?: number | null;
    repeatInterval?: number;
  }>;
}

interface BabysitterCardProps {
  babysitter: BabysitterCardData;
  isSelected?: boolean;
}

function BabysitterCard({ babysitter, isSelected }: BabysitterCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const rating = babysitter.averageRating ?? 0;
  const name = `${babysitter.firstName} ${babysitter.lastName}`;

  const starElements = useMemo(() => {
    const elements = [];
    for (let i = 1; i <= 5; i++) {
      elements.push(
        i <= Math.floor(rating) ? (
          <StarIconSolid key={i} className="h-3 w-3 text-yellow-400" />
        ) : (
          <StarIconSolid key={i} className="h-3 w-3 text-gray-200" />
        )
      );
    }
    return elements;
  }, [rating]);

  const hasBadge = (type: string) => babysitter.trustBadges.includes(type);

  const availabilityText = useMemo(() => {
    if (!babysitter.availability || babysitter.availability.length === 0) {
      return null;
    }
    const weekly = babysitter.availability.filter(a => !a.recurrenceType || a.recurrenceType === 'WEEKLY');
    const once = babysitter.availability.filter(a => a.recurrenceType === 'ONCE');
    const monthly = babysitter.availability.filter(a => a.recurrenceType === 'MONTHLY');

    const parts: string[] = [];
    if (weekly.length > 0) {
      const days = weekly.slice(0, 3).map(a => a.day).filter(Boolean);
      const extra = weekly.length > 3 ? ` +${weekly.length - 3}` : '';
      parts.push(days.join(', ') + extra);
    }
    if (once.length > 0) {
      parts.push(`${once.length} one-time date${once.length > 1 ? 's' : ''}`);
    }
    if (monthly.length > 0) {
      parts.push(`${monthly.length} monthly`);
    }
    return parts.join(' + ') || null;
  }, [babysitter.availability]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border cursor-pointer ${
        isSelected ? 'border-violet-500 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600'
      }`}
      onDoubleClick={() => setShowDetailModal(true)}
    >
      {/* Image */}
      <div className="relative h-32 overflow-hidden rounded-t-lg">
        <CaregiverProfileImage
          key={`bs-${babysitter.id}-${babysitter.avatar}`}
          name={name}
          id={babysitter.id}
          imageUrl={babysitter.avatar || ''}
          fill={true}
          className="w-full h-full"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorited(!isFavorited);
          }}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white transition"
        >
          {isFavorited ? (
            <HeartIconSolid className="h-4 w-4 text-violet-500" />
          ) : (
            <HeartIcon className="h-4 w-4 text-gray-700" />
          )}
        </button>

        {/* Trust Badges */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {/* Babysitter label */}
          <div className="bg-violet-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
            <span>Babysitter</span>
          </div>

          {hasBadge('VERIFIED_ID') && (
            <div className="bg-teal-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>Verified</span>
            </div>
          )}

          {hasBadge('BACKGROUND_CHECKED') && (
            <div className="bg-rose-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>BG Check</span>
            </div>
          )}

          {hasBadge('CPR_CERTIFIED') && (
            <div className="bg-amber-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>CPR</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {/* Header */}
        <div className="mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">{name}</h3>

          <div className="flex items-center text-xs text-gray-600 dark:text-gray-300 mb-1">
            <MapPinIcon className="h-3 w-3 mr-1" />
            <span>{babysitter.city}, {babysitter.state}</span>
          </div>

          {availabilityText ? (
            <div className="flex items-center text-xs text-green-600">
              <ClockIcon className="h-3 w-3 mr-1" />
              <span>{availabilityText}</span>
            </div>
          ) : (
            <div className="flex items-center text-xs text-gray-500">
              <ClockIcon className="h-3 w-3 mr-1" />
              <span>Contact for availability</span>
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center mb-2">
          <div className="flex items-center">
            {starElements}
            {rating > 0 ? (
              <>
                <span className="ml-1 text-xs font-medium text-gray-900 dark:text-white">
                  {rating.toFixed(2)}
                </span>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  ({babysitter.reviewCount})
                </span>
              </>
            ) : (
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">New</span>
            )}
          </div>
        </div>

        {/* Experience & Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {babysitter.experienceYears > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded">
              {babysitter.experienceYears}yr exp
            </span>
          )}
          {babysitter.acceptsOnsitePayment && (
            <span className="px-1.5 py-0.5 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded">
              On-site pay
            </span>
          )}
          {hasBadge('ECE_TRAINED') && (
            <span className="px-1.5 py-0.5 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded">
              ECE
            </span>
          )}
        </div>

        {/* Price and View Button */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              ${babysitter.hourlyRate}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/hr</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowBookingModal(true);
            }}
            className="bg-violet-500 hover:bg-violet-600 text-white px-2 py-1 rounded text-xs font-medium transition"
          >
            Book
          </button>
        </div>
      </div>

      {showDetailModal && (
        <BabysitterDetailModal
          babysitter={babysitter}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onBook={() => {
            setShowDetailModal(false);
            setShowBookingModal(true);
          }}
        />
      )}

      {showBookingModal && (
        <BookBabysitterModal
          babysitterId={babysitter.id}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
}

export default memo(BabysitterCard);
