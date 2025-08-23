"use client";

import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'small' | 'medium' | 'large';
  showValue?: boolean;
  className?: string;
  maxRating?: number;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  readonly = false,
  size = 'medium',
  showValue = false,
  className = '',
  maxRating = 5
}) => {
  const [hoverRating, setHoverRating] = useState<number>(0);

  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-5 w-5',
    large: 'h-6 w-6'
  };

  const handleStarClick = (starRating: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const handleStarHover = (starRating: number) => {
    if (!readonly) {
      setHoverRating(starRating);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div 
        className="flex items-center"
        onMouseLeave={handleMouseLeave}
      >
        {[...Array(maxRating)].map((_, index) => {
          const starRating = index + 1;
          const isFilled = starRating <= displayRating;
          const isPartialFilled = !readonly && displayRating > index && displayRating < starRating;
          
          return (
            <button
              key={index}
              type="button"
              disabled={readonly}
              className={`
                ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}
                ${!readonly ? 'focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 rounded' : ''}
              `}
              onClick={() => handleStarClick(starRating)}
              onMouseEnter={() => handleStarHover(starRating)}
            >
              {isFilled ? (
                <StarIcon 
                  className={`${sizeClasses[size]} text-yellow-400 ${
                    !readonly && hoverRating === starRating ? 'text-yellow-500' : ''
                  }`} 
                />
              ) : (
                <StarOutlineIcon 
                  className={`${sizeClasses[size]} text-gray-300 ${
                    !readonly ? 'hover:text-yellow-300' : ''
                  }`} 
                />
              )}
            </button>
          );
        })}
      </div>
      
      {showValue && (
        <span className={`
          ml-2 font-medium
          ${size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-base'}
          ${rating > 0 ? 'text-gray-700' : 'text-gray-400'}
        `}>
          {rating > 0 ? rating.toFixed(1) : 'No rating'}
        </span>
      )}
    </div>
  );
};

export default StarRating;