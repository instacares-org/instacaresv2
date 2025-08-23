"use client";

import React, { useState } from 'react';
import { 
  StarIcon, 
  HeartIcon, 
  MapPinIcon, 
  ClockIcon, 
  ShieldCheckIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import { 
  StarIcon as StarIconSolid, 
  HeartIcon as HeartIconSolid 
} from "@heroicons/react/24/solid";
import CaregiverProfileImage from './CaregiverProfileImage';
import BookingModal from './BookingModal';
import { Button } from './ui/Button';
import { CaregiverCardSkeleton } from './ui/LoadingSkeleton';
import { cn } from '../lib/utils';

export interface Caregiver {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  distance: string;
  description: string;
  specialties: string[];
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  availability: string;
  verified: boolean;
  experience: string;
  stripeAccountId?: string;
}

interface ImprovedCaregiverCardProps {
  caregiver: Caregiver;
  onHover?: (caregiver: Caregiver | null) => void;
  isSelected?: boolean;
  isLoading?: boolean;
  className?: string;
}

const ImprovedCaregiverCard: React.FC<ImprovedCaregiverCardProps> = ({ 
  caregiver, 
  onHover, 
  isSelected = false,
  isLoading = false,
  className 
}) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  if (isLoading) {
    return <CaregiverCardSkeleton />;
  }

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  const handleBookingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBookingModal(true);
  };

  const handleCardClick = () => {
    // In a real app, this would navigate to detailed caregiver profile
    console.log('Navigate to caregiver profile:', caregiver.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  return (
    <>
      <article 
        className={cn(
          "bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2",
          isSelected ? 'border-rose-500 shadow-md ring-2 ring-rose-500' : 'border-gray-100 hover:border-gray-200',
          className
        )}
        onMouseEnter={() => onHover?.(caregiver)}
        onMouseLeave={() => onHover?.(null)}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View ${caregiver.name}'s profile`}
      >
        {/* Image Section */}
        <div className="relative h-32 overflow-hidden rounded-t-xl">
          <CaregiverProfileImage
            src={caregiver.image}
            alt={`${caregiver.name}, childcare provider`}
            size="full"
            className="object-cover transition-transform duration-200 hover:scale-105"
          />
          
          {/* Favorite Button */}
          <button
            onClick={handleFavoriteToggle}
            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorited ? (
              <HeartIconSolid className="h-4 w-4 text-rose-500" />
            ) : (
              <HeartIcon className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Verification Badge */}
          {caregiver.verified && (
            <div className="absolute top-2 left-2 flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              <CheckBadgeIcon className="h-3 w-3 mr-1" />
              <span>Verified</span>
            </div>
          )}

          {/* Availability Indicator */}
          <div className="absolute bottom-2 left-2">
            <div className={cn(
              "flex items-center px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
              caregiver.availability.toLowerCase().includes('available') 
                ? "bg-green-100/90 text-green-800" 
                : "bg-yellow-100/90 text-yellow-800"
            )}>
              <ClockIcon className="h-3 w-3 mr-1" />
              <span>{caregiver.availability}</span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-lg">
                {caregiver.name}
              </h3>
              <div className="flex items-center mt-1 space-x-3">
                <div className="flex items-center">
                  <StarIconSolid className="h-4 w-4 text-yellow-400 mr-1" />
                  <span className="text-sm font-medium text-gray-900">
                    {caregiver.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    ({caregiver.reviewCount})
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <MapPinIcon className="h-3 w-3 mr-1" />
                  <span>{caregiver.distance}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                ${caregiver.hourlyRate}
                <span className="text-sm font-normal text-gray-500">/hr</span>
              </div>
            </div>
          </div>

          {/* Experience */}
          <div className="text-sm text-gray-600">
            {caregiver.experience}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
            {caregiver.description}
          </p>

          {/* Specialties */}
          {caregiver.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {caregiver.specialties.slice(0, 3).map((specialty, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800"
                >
                  {specialty}
                </span>
              ))}
              {caregiver.specialties.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  +{caregiver.specialties.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button
              onClick={handleBookingClick}
              className="w-full"
              size="sm"
              aria-label={`Book ${caregiver.name} for childcare`}
            >
              Book Now
            </Button>
          </div>
        </div>
      </article>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          caregiver={caregiver}
          onClose={() => setShowBookingModal(false)}
        />
      )}
    </>
  );
};

export default ImprovedCaregiverCard;