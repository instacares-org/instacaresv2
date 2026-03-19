"use client";

import { HeartIcon, MapPinIcon, ClockIcon, ShieldCheckIcon, ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { addCSRFHeader } from '@/lib/csrf';
import CaregiverProfileImage from "./CaregiverProfileImage";
import BabysitterDetailModal from "./BabysitterDetailModal";
import BookBabysitterModal from "./BookBabysitterModal";
import BookingChatModal from "./BookingChatModal";
import { useAuth } from "../contexts/AuthContext";

export interface BabysitterCardData {
  id: string;
  userId: string;
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
  isFavorited?: boolean;
  onFavoriteToggle?: (providerId: string, isFavorited: boolean) => void;
}

function BabysitterCard({ babysitter, isSelected, isFavorited: isFavoritedProp, onFavoriteToggle }: BabysitterCardProps) {
  const { isAuthenticated, isParent, user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(isFavoritedProp ?? false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (isFavoritedProp !== undefined) setIsFavorited(isFavoritedProp);
  }, [isFavoritedProp]);

  const handleFavoriteToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated || !isParent) return;
    if (favLoading) return;

    const providerId = babysitter.userId;
    const newState = !isFavorited;
    setIsFavorited(newState);
    setFavLoading(true);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ providerId }),
      });
      if (res.ok) {
        const data = await res.json();
        const serverState = data.data?.isFavorited ?? newState;
        setIsFavorited(serverState);
        onFavoriteToggle?.(providerId, serverState);
      } else {
        setIsFavorited(!newState);
      }
    } catch {
      setIsFavorited(!newState);
    } finally {
      setFavLoading(false);
    }
  }, [isAuthenticated, isParent, isFavorited, favLoading, babysitter.userId, onFavoriteToggle]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

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
        {isAuthenticated && isParent && (
          <button
            onClick={handleFavoriteToggle}
            disabled={favLoading}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition shadow-sm"
          >
            {isFavorited ? (
              <HeartIconSolid className="h-4 w-4 shrink-0 text-violet-500" />
            ) : (
              <HeartIcon className="h-4 w-4 shrink-0 text-gray-700" />
            )}
          </button>
        )}

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

        {/* Price and Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              ${babysitter.hourlyRate}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/hr</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isAuthenticated && isParent && babysitter.userId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChatModal(true);
                }}
                className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 p-1.5 rounded-lg transition"
                title="Message"
              >
                <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
              </button>
            )}
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

      {showChatModal && user && babysitter.userId && (
        <BookingChatModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          directProviderId={babysitter.userId}
          otherPartyName={name}
          otherPartyAvatar={babysitter.avatar || undefined}
          otherPartyId={babysitter.userId}
          currentUserId={user.id}
          currentUserName={user.profile?.firstName || user.name || 'User'}
        />
      )}
    </div>
  );
}

export default memo(BabysitterCard);
