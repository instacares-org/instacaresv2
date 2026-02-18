"use client";

import { useState, memo, useMemo } from 'react';
import {
  StarIcon,
  HeartIcon,
  MapPinIcon,
  ClockIcon,
  ShieldCheckIcon,
  HomeIcon,
  BuildingOfficeIcon
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import CaregiverProfileImage from "./CaregiverProfileImage";

interface Caregiver {
  id: string;
  caregiverId?: string;
  name: string;
  image: string;
  profilePhoto?: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  babysittingRate?: number;
  offersBabysitting: boolean;
  distance: string;
  numericDistance?: number | null;
  description?: string;
  bio?: string;
  experienceYears?: number;
  specialties: string[];
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  city?: string;
  availability?: string;
  hasAvailability?: boolean;
  verified: boolean;
  experience?: string;
  estimatedTravel?: number;
  babysittingNotes?: string;
  stripeOnboarded?: boolean;
  canReceivePayments?: boolean;
  verification?: {
    backgroundCheck?: boolean;
    verificationScore?: number;
  };
}

interface BabysittingCaregiverCardProps {
  caregiver: Caregiver;
  serviceMode: 'daycare' | 'babysitting';
  onBookNow: (caregiverId: string, serviceMode: 'daycare' | 'babysitting') => void;
  onSwitchService?: (caregiverId: string, newMode: 'daycare' | 'babysitting') => void;
  onHover?: (caregiver: Caregiver | null) => void;
  isSelected?: boolean;
}

function BabysittingCaregiverCard({
  caregiver,
  serviceMode,
  onBookNow,
  onSwitchService,
  onHover,
  isSelected
}: BabysittingCaregiverCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);

  const currentRate = serviceMode === 'babysitting' ? caregiver.babysittingRate : caregiver.hourlyRate;
  const offersBothServices = caregiver.offersBabysitting && caregiver.hourlyRate;

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
    >
      {/* Service Type Header - Compact */}
      <div className={`px-2 py-1 text-xs font-medium flex items-center justify-between ${
        serviceMode === 'babysitting'
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      }`}>
        <div className="flex items-center">
          {serviceMode === 'babysitting' ? (
            <>
              <HomeIcon className="h-3 w-3 mr-1" />
              <span>At Your Home</span>
            </>
          ) : (
            <>
              <BuildingOfficeIcon className="h-3 w-3 mr-1" />
              <span>At Facility</span>
            </>
          )}
        </div>
        {offersBothServices && (
          <span className="text-[10px] opacity-75">Offers Both</span>
        )}
      </div>

      {/* Image */}
      <div className="relative h-32 overflow-hidden">
        <CaregiverProfileImage
          key={`${caregiver.id}-${caregiver.profilePhoto || caregiver.image}`}
          name={caregiver.name}
          id={caregiver.id}
          imageUrl={caregiver.profilePhoto || caregiver.image}
          fill={true}
          className="w-full h-full"
        />

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorited(!isFavorited);
          }}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white transition"
        >
          {isFavorited ? (
            <HeartIconSolid className="h-4 w-4 text-rose-500" />
          ) : (
            <HeartIcon className="h-4 w-4 text-gray-700" />
          )}
        </button>

        {/* Trust Indicators */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {caregiver.verified && (
            <div className="bg-teal-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>VERIFIED</span>
            </div>
          )}

          {caregiver.verification?.backgroundCheck && (
            <div className="bg-rose-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>BG CHECK ✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {/* Header */}
        <div className="mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">{caregiver.name}</h3>

          {/* Location */}
          <div className="flex items-center text-xs text-gray-600 dark:text-gray-300 mb-1">
            <MapPinIcon className="h-3 w-3 mr-1" />
            <span>
              {serviceMode === 'babysitting'
                ? `${caregiver.distance} away (${caregiver.estimatedTravel || '15'} min travel)`
                : caregiver.address?.city && caregiver.address?.province
                  ? `${caregiver.address.city}, ${caregiver.address.province}`
                  : caregiver.city || caregiver.distance
              }
            </span>
          </div>

          {/* Availability / Service Info */}
          {serviceMode === 'babysitting' && caregiver.babysittingNotes ? (
            <div className="flex items-start text-xs text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded px-1.5 py-1 mb-1">
              <span className="italic line-clamp-1">"{caregiver.babysittingNotes}"</span>
            </div>
          ) : (
            <div className={`flex items-center text-xs ${
              caregiver.availability === "No Availability Posted Yet"
                ? 'text-gray-500'
                : caregiver.availability?.includes("Available today") || caregiver.availability?.includes("Available tomorrow")
                ? 'text-green-600'
                : caregiver.availability?.includes("Available this week")
                ? 'text-blue-600'
                : 'text-orange-600'
            }`}>
              <ClockIcon className="h-3 w-3 mr-1" />
              <span>{caregiver.availability || 'Contact for availability'}</span>
            </div>
          )}
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

        {/* Specialties */}
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

        {/* Price and Book Button */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              ${currentRate}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/hr</span>
            {offersBothServices && (
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {serviceMode === 'babysitting'
                  ? `Daycare: $${caregiver.hourlyRate}/hr`
                  : `Babysit: $${caregiver.babysittingRate}/hr`
                }
              </div>
            )}
          </div>

          {caregiver.stripeOnboarded && caregiver.canReceivePayments ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookNow(caregiver.id, serviceMode);
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition text-white ${
                serviceMode === 'babysitting'
                  ? 'bg-purple-500 hover:bg-purple-600'
                  : 'bg-rose-500 hover:bg-rose-600'
              }`}
            >
              Book
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Setup</span>
            </div>
          )}
        </div>

        {/* Switch Service Button (if offers both) */}
        {offersBothServices && onSwitchService && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwitchService(caregiver.id, serviceMode === 'babysitting' ? 'daycare' : 'babysitting');
            }}
            className="w-full mt-2 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center text-gray-700 dark:text-gray-300"
          >
            {serviceMode === 'babysitting' ? (
              <>
                <BuildingOfficeIcon className="h-3 w-3 mr-1" />
                Switch to Daycare
              </>
            ) : (
              <>
                <HomeIcon className="h-3 w-3 mr-1" />
                Switch to Babysitting
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(BabysittingCaregiverCard);
