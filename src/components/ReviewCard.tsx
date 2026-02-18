"use client";

import React from 'react';
import { ClockIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';

export interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt?: string;
  moderatedAt?: string;
  moderatorNotes?: string;
  reviewer: {
    id: string;
    name: string;
    avatar?: string;
  };
  reviewee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  booking?: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  };
}

interface ReviewCardProps {
  review: ReviewData;
  showModeration?: boolean;
  showReviewee?: boolean;
  onModerationAction?: (reviewId: string, action: 'approve' | 'reject', notes?: string) => void;
  currentUserId?: string;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  showModeration = false,
  showReviewee = false,
  onModerationAction,
  currentUserId
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  const isRecentlyUpdated = review.updatedAt && 
    new Date(review.updatedAt).getTime() > new Date(review.createdAt).getTime() + 60000; // 1 minute buffer

  return (
    <div className={`
      bg-white rounded-lg border p-4 space-y-3
      ${!review.isApproved ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}
    `}>
      {/* Status Banner */}
      {!review.isApproved && (
        <div className="flex items-center space-x-2 text-yellow-700 text-sm">
          <ClockIcon className="h-4 w-4" />
          <span>Pending approval</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {/* Reviewer Avatar */}
          {review.reviewer.avatar ? (
            <img
              src={review.reviewer.avatar}
              alt={review.reviewer.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {review.reviewer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{review.reviewer.name}</h4>
              {review.booking && (
                <CheckBadgeIcon className="h-4 w-4 text-blue-500" title="Verified booking" />
              )}
            </div>
            
            {showReviewee && review.reviewee && (
              <p className="text-sm text-gray-500">
                Review for {review.reviewee.name}
              </p>
            )}
            
            <div className="flex items-center space-x-2 mt-1">
              <StarRating rating={review.rating} readonly size="small" />
              <span className="text-sm text-gray-500">
                {formatDate(review.createdAt)}
                {isRecentlyUpdated && (
                  <span className="ml-1 text-blue-500">(edited)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Booking Date */}
        {review.booking && (
          <div className="text-right text-sm text-gray-500">
            <div>Service Date</div>
            <div>{new Date(review.booking.startTime).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      {/* Review Comment */}
      <div className="pl-13">
        <p className="text-gray-700 leading-relaxed">
          {review.comment}
        </p>
      </div>

      {/* Moderation Section */}
      {showModeration && !review.isApproved && onModerationAction && (
        <div className="border-t pt-3 space-y-3">
          <div className="flex space-x-2">
            <button
              onClick={() => onModerationAction(review.id, 'approve')}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              Approve
            </button>
            <button
              onClick={() => onModerationAction(review.id, 'reject', 'Rejected by moderator')}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
            >
              Reject
            </button>
          </div>
          
          {review.moderatorNotes && (
            <div className="bg-gray-50 border border-gray-200 rounded p-2">
              <div className="text-xs text-gray-500 mb-1">Moderator Notes:</div>
              <div className="text-sm text-gray-700">{review.moderatorNotes}</div>
            </div>
          )}
        </div>
      )}

      {/* Admin Info */}
      {showModeration && review.isApproved && review.moderatedAt && (
        <div className="border-t pt-2 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <CheckBadgeIcon className="h-3 w-3 text-green-500" />
            <span>Approved on {new Date(review.moderatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Edit indicator for user's own reviews */}
      {currentUserId === review.reviewer.id && (
        <div className="border-t pt-2 text-xs text-gray-500">
          Reviews can be edited within 24 hours of posting
        </div>
      )}
    </div>
  );
};

export default ReviewCard;