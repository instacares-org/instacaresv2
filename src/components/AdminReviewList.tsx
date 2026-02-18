"use client";

import React, { useState, useEffect } from 'react';
import { 
  StarIcon,
  ClockIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import StarRating from './StarRating';

interface ReviewData {
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
  reviewee: {
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

interface AdminReviewListProps {
  filterStatus: 'all' | 'pending' | 'approved';
  onModerationAction: (reviewId: string, action: 'approve' | 'reject', notes?: string) => Promise<void>;
}

const AdminReviewList: React.FC<AdminReviewListProps> = ({
  filterStatus,
  onModerationAction
}) => {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    total: 0,
    averageRating: 0
  });

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      // Fetch all reviews
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(filterStatus !== 'all' && { 
          approved: filterStatus === 'approved' ? 'true' : 'false' 
        })
      });

      const response = await fetch(`/api/reviews?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }

      setReviews(data.reviews || []);
      
      // Calculate stats
      const allReviews = data.reviews || [];
      const pending = allReviews.filter((r: ReviewData) => !r.isApproved);
      const approved = allReviews.filter((r: ReviewData) => r.isApproved);
      const avgRating = approved.length > 0
        ? approved.reduce((sum: number, r: ReviewData) => sum + r.rating, 0) / approved.length
        : 0;

      setStats({
        pending: pending.length,
        approved: approved.length,
        total: allReviews.length,
        averageRating: parseFloat(avgRating.toFixed(1))
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filterStatus]);

  const handleModeration = async (reviewId: string, action: 'approve' | 'reject') => {
    try {
      await onModerationAction(reviewId, action);
      // Refresh the list after moderation
      await fetchReviews();
    } catch (error) {
      console.error('Moderation error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Approved</p>
              <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
            </div>
            <CheckBadgeIcon className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total Reviews</p>
              <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
            </div>
            <StarIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-600">Avg Rating</p>
              <p className="text-2xl font-bold text-indigo-700">{stats.averageRating}</p>
            </div>
            <StarRating rating={stats.averageRating} readonly size="small" />
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <StarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Found</h3>
            <p className="text-gray-500">
              {filterStatus === 'pending' 
                ? "No pending reviews to moderate"
                : filterStatus === 'approved'
                ? "No approved reviews yet"
                : "No reviews have been submitted yet"
              }
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-lg border p-4 ${
                !review.isApproved ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              {/* Status Banner */}
              {!review.isApproved && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-yellow-700 text-sm">
                    <ClockIcon className="h-4 w-4" />
                    <span>Pending approval</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleModeration(review.id, 'approve')}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleModeration(review.id, 'reject')}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Review Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
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
                      <span className="text-gray-500">→</span>
                      <span className="text-gray-700">{review.reviewee.name}</span>
                      {review.booking && (
                        <CheckBadgeIcon className="h-4 w-4 text-blue-500" title="Verified booking" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      <StarRating rating={review.rating} readonly size="small" />
                      <span className="text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Booking Info */}
                {review.booking && (
                  <div className="text-right text-sm text-gray-500">
                    <div>Booking #{review.booking.id.slice(-6)}</div>
                    <div>{formatDate(review.booking.startTime)}</div>
                  </div>
                )}
              </div>

              {/* Review Comment */}
              <div className="mt-3 pl-13">
                <p className="text-gray-700 leading-relaxed">
                  {review.comment}
                </p>
              </div>

              {/* Moderation Info */}
              {review.isApproved && review.moderatedAt && (
                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <CheckBadgeIcon className="h-3 w-3 text-green-500" />
                    <span>Approved on {formatDate(review.moderatedAt)}</span>
                  </div>
                </div>
              )}

              {review.moderatorNotes && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="text-xs text-gray-500 mb-1">Moderator Notes:</div>
                  <div className="text-sm text-gray-700">{review.moderatorNotes}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default AdminReviewList;