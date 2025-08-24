"use client";

import Image from "next/image";
import { StarIcon, HeartIcon, MapPinIcon, ClockIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useState, memo, useMemo } from "react";
import CaregiverProfileImage from "./CaregiverProfileImage";
import BookingModal from "./BookingModal";
import CaregiverDetailModal from "./CaregiverDetailModal";

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
  verification?: VerificationData;
  phone?: string; // Add phone for additional identification
  city?: string; // Add city for location distinction
}

interface CaregiverCardProps {
  caregiver: Caregiver;
  onHover?: (caregiver: Caregiver | null) => void;
  isSelected?: boolean;
}

function CaregiverCard({ caregiver, onHover, isSelected }: CaregiverCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
        {caregiver.name.includes('Fazila') && console.log('CaregiverCard Debug:', {
          name: caregiver.name,
          profilePhoto: caregiver.profilePhoto,
          image: caregiver.image,
          finalImageUrl: caregiver.profilePhoto || caregiver.image
        })}
        <CaregiverProfileImage
          key={`${caregiver.id}-${caregiver.profilePhoto || caregiver.image}`}
          name={caregiver.name}
          id={caregiver.id}
          imageUrl={caregiver.profilePhoto || caregiver.image}
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
            <HeartIconSolid className="h-4 w-4 text-rose-500" />
          ) : (
            <HeartIcon className="h-4 w-4 text-gray-700" />
          )}
        </button>
        
        {/* Enhanced Trust Indicators - Brand Aligned Colors */}
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
              <span>BACKGROUND CHECK ✓</span>
            </div>
          )}
          
          {caregiver.verification?.verificationScore && caregiver.verification.verificationScore >= 90 && (
            <div className="bg-amber-600 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center shadow-lg">
              <StarIcon className="h-3 w-3 mr-1" />
              <span>TOP RATED</span>
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
          {caregiver.email && (
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
              ${caregiver.hourlyRate}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/hr</span>
          </div>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowBookingModal(true);
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded text-xs font-medium transition"
          >
            Book
          </button>
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
          caregiver={caregiver}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(CaregiverCard);