"use client";

import Image from "next/image";
import { StarIcon, HeartIcon, MapPinIcon, ClockIcon, ShieldCheckIcon, ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { addCSRFHeader } from '@/lib/csrf';
import CaregiverProfileImage from "./CaregiverProfileImage";
import BookingModal from "./BookingModal";
import CaregiverDetailModal from "./CaregiverDetailModal";
import BookingChatModal from "./BookingChatModal";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";

export interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCapacity: number;
  availableSpots: number;
  baseRate: number;
  status: string;
}

export interface VerificationData {
  backgroundCheck?: boolean;
  verificationScore?: number;
}

export interface Caregiver {
  id: string; // This is the USER ID (for booking creation)
  caregiverId: string; // This is the CAREGIVER record ID (for reference) - REQUIRED
  name: string;
  email?: string; // Add email for unique identification
  image: string;
  profilePhoto?: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  distance: string;
  numericDistance?: number | null; // Add numeric distance for sorting
  description: string;
  bio?: string; // Add bio field from database
  experienceYears?: number; // Add experience years from database
  specialties: string[];
  ageGroups?: { id: string; name: string; description?: string }[];
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
  availability: string;
  availabilitySlots?: AvailabilitySlot[]; // Add availability slots data
  hasAvailability?: boolean; // Quick check for availability
  verified: boolean;
  experience: string;
  stripeAccountId?: string;
  stripeOnboarded?: boolean;
  canReceivePayments?: boolean;
  verification?: VerificationData;
  phone?: string; // Add phone for additional identification
  city?: string; // Add city for location distinction
  services?: { type: string; rate?: number; description?: string }[]; // Services offered by caregiver
  maxChildren?: number; // Maximum children the caregiver can handle
}

interface CaregiverCardProps {
  showContactInfo?: boolean;
  caregiver: Caregiver;
  onHover?: (caregiver: Caregiver | null) => void;
  isSelected?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: (providerId: string, isFavorited: boolean) => void;
}

function CaregiverCard({ caregiver, onHover, isSelected, showContactInfo = false, isFavorited: isFavoritedProp, onFavoriteToggle }: CaregiverCardProps) {
  const { t } = useLanguage();
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

    const newState = !isFavorited;
    setIsFavorited(newState); // Optimistic update
    setFavLoading(true);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ providerId: caregiver.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const serverState = data.data?.isFavorited ?? newState;
        setIsFavorited(serverState);
        onFavoriteToggle?.(caregiver.id, serverState);
      } else {
        setIsFavorited(!newState); // Revert on failure
      }
    } catch {
      setIsFavorited(!newState); // Revert on error
    } finally {
      setFavLoading(false);
    }
  }, [isAuthenticated, isParent, isFavorited, favLoading, caregiver.id, onFavoriteToggle]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // Debug logging for Isabella specifically
  if (caregiver.name === 'Isabella Rodriguez') {
    console.log('🎯 CaregiverCard - Isabella Props:', {
      'caregiver.id': caregiver.id,
      'caregiver.caregiverId': caregiver.caregiverId,
      hasId: !!caregiver.id,
      hasCaregiverId: !!caregiver.caregiverId
    });
  }

  // Memoize expensive star calculations
  const starElements = useMemo(() => {
    const elements = [];
    for (let i = 1; i <= 5; i++) {
      elements.push(
        i <= Math.floor(caregiver.rating) ? (
          <StarIconSolid key={i} className="h-3 w-3 text-yellow-400" />
        ) : (
          <StarIconSolid key={i} className="h-3 w-3 text-gray-200" />
        )
      );
    }
    return elements;
  }, [caregiver.rating]);

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border cursor-pointer ${
        isSelected ? 'border-rose-500 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onMouseEnter={() => onHover?.(caregiver)}
      onMouseLeave={() => onHover?.(null)}
      onDoubleClick={() => setShowDetailModal(true)}
    >
      {/* Image */}
      <div className="relative h-32 overflow-hidden rounded-t-lg">
        {/* Debug log removed for CaregiverCard */}
        <CaregiverProfileImage
          key={`${caregiver.id}-${caregiver.profilePhoto || caregiver.image}`}
          name={caregiver.name}
          id={caregiver.id}
          imageUrl={caregiver.profilePhoto || caregiver.image}
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
              <HeartIconSolid className="h-4 w-4 shrink-0 text-rose-500" />
            ) : (
              <HeartIcon className="h-4 w-4 shrink-0 text-gray-700" />
            )}
          </button>
        )}
        
        {/* Enhanced Trust Indicators - Brand Aligned Colors */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {caregiver.verified && (
            <div className="bg-teal-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>{t('caregiver.verified')}</span>
            </div>
          )}
          
          {caregiver.verification?.backgroundCheck && (
            <div className="bg-rose-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>{t('caregiver.backgroundCheckBadge')}</span>
            </div>
          )}
          
          {caregiver.verification?.verificationScore && caregiver.verification.verificationScore >= 90 && (
            <div className="bg-amber-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <StarIcon className="h-3 w-3 mr-1" />
              <span>{t('caregiver.topRated')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {/* Header */}
        <div className="mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">{caregiver.name}</h3>
          
          {/* Email for unique identification */}
          {(() => { console.log("🔍 CaregiverCard Debug:", { caregiverName: caregiver.name, showContactInfo, hasEmail: !!caregiver.email, email: caregiver.email, willDisplay: showContactInfo && caregiver.email }); return null; })()}
          {showContactInfo && caregiver.email && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
              {caregiver.email}
            </div>
          )}
          
          <div className="flex items-center text-xs text-gray-600 dark:text-gray-300 mb-1">
            <MapPinIcon className="h-3 w-3 mr-1" />
            <span>
              {caregiver.address?.city && caregiver.address?.province 
                ? `${caregiver.address.city}, ${caregiver.address.province}` 
                : caregiver.city || caregiver.distance}
            </span>
          </div>
          <div className={`flex items-center text-xs ${
            caregiver.availability === "No Availability Posted Yet" 
              ? 'text-gray-500' 
              : caregiver.availability.includes("Available today") || caregiver.availability.includes("Available tomorrow")
              ? 'text-green-600'
              : caregiver.availability.includes("Available this week")
              ? 'text-blue-600'  
              : 'text-orange-600'
          }`}>
            <ClockIcon className="h-3 w-3 mr-1" />
            <span>{caregiver.availability}</span>
            {caregiver.hasAvailability && caregiver.availabilitySlots && caregiver.availabilitySlots.length > 0 && (
              <span className="ml-1 text-xs text-gray-400">
                ({caregiver.availabilitySlots.length} slot{caregiver.availabilitySlots.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>

        </div>

        {/* Rating */}
        <div className="flex items-center mb-2">
          <div className="flex items-center">
            {starElements}
            <span className="ml-1 text-xs font-medium text-gray-900 dark:text-white">
              {caregiver.rating.toFixed(2)}
            </span>
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              ({caregiver.reviewCount})
            </span>
          </div>
        </div>


        {/* Services Offered */}
        {caregiver.services && caregiver.services.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {caregiver.services.slice(0, 2).map((service) => (
              <span
                key={service.type}
                className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {{ DAYCARE: 'Full-day care', BABYSITTING: 'Half-day care', AFTER_SCHOOL: 'Before/after school', OVERNIGHT: 'Overnight care', NANNY: 'Drop-in care' }[service.type] || service.type}
              </span>
            ))}
            {caregiver.services.length > 2 && (
              <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                +{caregiver.services.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Age Groups */}
        {caregiver.ageGroups && caregiver.ageGroups.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
            Ages: {caregiver.ageGroups.map(g => g.name).join(', ')}
          </div>
        )}

        {/* Specialties */}
        {caregiver.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {caregiver.specialties.slice(0, 2).map((specialty) => (
              <span
                key={specialty}
                className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {specialty}
              </span>
            ))}
            {caregiver.specialties.length > 2 && (
              <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                +{caregiver.specialties.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Price and Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              ${caregiver.hourlyRate}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('caregiver.hourlyRate')}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isAuthenticated && isParent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChatModal(true);
                }}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1.5 rounded-lg transition"
                title="Message"
              >
                <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
              </button>
            )}
            {caregiver.stripeOnboarded && caregiver.canReceivePayments ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBookingModal(true);
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded text-xs font-medium transition"
              >
                {t('common.book')}
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{t('caregiver.setupInProgress')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showBookingModal && (
        <BookingModal
          caregiver={caregiver}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}
      
      {showDetailModal && (
        <CaregiverDetailModal
          showContactInfo={showContactInfo}
          caregiver={caregiver}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onBookNow={() => {
            setShowDetailModal(false);
            setShowBookingModal(true);
          }}
        />
      )}

      {showChatModal && user && (
        <BookingChatModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          directProviderId={caregiver.id}
          otherPartyName={caregiver.name}
          otherPartyAvatar={caregiver.profilePhoto || caregiver.image}
          otherPartyId={caregiver.id}
          currentUserId={user.id}
          currentUserName={user.profile?.firstName || user.name || 'User'}
        />
      )}
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(CaregiverCard);