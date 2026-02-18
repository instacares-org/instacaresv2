"use client";

import React, { useState } from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';

interface ReviewFormProps {
  booking: {
    id: string;
    caregiverId: string;
    caregiverName: string;
    caregiverImage?: string;
  };
  onSubmit: (reviewData: ReviewFormData) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export interface ReviewFormData {
  bookingId: string;
  revieweeId: string;
  rating: number;
  comment: string;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  booking,
  onSubmit,
  onClose,
  isLoading = false
}) => {
  const { id: bookingId, caregiverId: revieweeId, caregiverName: revieweeName, caregiverImage: revieweeAvatar } = booking;
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [errors, setErrors] = useState<{rating?: string; comment?: string}>({});

  const validateForm = (): boolean => {
    const newErrors: {rating?: string; comment?: string} = {};

    if (rating === 0) {
      newErrors.rating = 'Please select a rating';
    }

    if (comment.trim().length < 10) {
      newErrors.comment = 'Please provide at least 10 characters in your review';
    }

    if (comment.trim().length > 1000) {
      newErrors.comment = 'Review must be less than 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        bookingId,
        revieweeId,
        rating,
        comment: comment.trim()
      });
    } catch (error) {
      console.error('Error submitting review:', error);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);
    
    // Clear comment error if user starts typing valid content
    if (errors.comment && value.trim().length >= 10) {
      setErrors(prev => ({ ...prev, comment: undefined }));
    }
  };

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    
    // Clear rating error when user selects a rating
    if (errors.rating && newRating > 0) {
      setErrors(prev => ({ ...prev, rating: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Leave a Review
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Reviewee Info */}
          <div className="flex items-center space-x-3">
            {revieweeAvatar ? (
              <img
                src={revieweeAvatar}
                alt={revieweeName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {revieweeName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-medium text-gray-900">{revieweeName}</h3>
              <p className="text-sm text-gray-500">How was your experience?</p>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <StarRating
                rating={rating}
                onRatingChange={handleRatingChange}
                size="large"
              />
              {rating > 0 && (
                <span className="text-sm text-gray-600 ml-2">
                  {rating === 1 ? 'Poor' :
                   rating === 2 ? 'Fair' :
                   rating === 3 ? 'Good' :
                   rating === 4 ? 'Very Good' :
                   'Excellent'}
                </span>
              )}
            </div>
            {errors.rating && (
              <p className="text-sm text-red-600">{errors.rating}</p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Review <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={handleCommentChange}
              rows={4}
              className={`
                w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500
                ${errors.comment ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Share your experience with others. What went well? How was the communication?"
              disabled={isLoading}
            />
            <div className="flex justify-between text-sm">
              <span className={errors.comment ? 'text-red-600' : 'text-gray-500'}>
                {errors.comment || `${comment.length}/1000 characters`}
              </span>
              {comment.trim().length >= 10 && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Review Guidelines:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Be honest and constructive</li>
              <li>• Focus on your experience</li>
              <li>• Avoid personal attacks or offensive language</li>
              <li>• Reviews are moderated and may take time to appear</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || rating === 0 || comment.trim().length < 10}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4" />
                  <span>Submit Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewForm;