"use client";

import React, { useState, useEffect } from 'react';
import { 
  FunnelIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  StarIcon,
  ClockIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';
import ReviewCard, { ReviewData } from './ReviewCard';
import StarRating from './StarRating';

interface ReviewListProps {
  userId: string;
  userType: 'given' | 'received' | 'all';
  showModeration?: boolean;
  currentUserId?: string;
  onModerationAction?: (reviewId: string, action: 'approve' | 'reject', notes?: string) => void;
  className?: string;
}

interface ReviewFilters {
  rating: number | null;
  approved: 'all' | 'approved' | 'pending';
  sortBy: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  approvedReviews: number;
  pendingReviews: number;
  ratingDistribution: { [key: number]: number };
}

const ReviewList: React.FC<ReviewListProps> = ({
  userId,
  userType,
  showModeration = false,
  currentUserId,
  onModerationAction,
  className = ''
}) => {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ReviewFilters>({
    rating: null,
    approved: 'approved',
    sortBy: 'newest'
  });

  const fetchReviews = async (resetPage = false) => {
    try {
      setLoading(true);
      const currentPage = resetPage ? 1 : page;
      
      const params = new URLSearchParams({
        ...(userId !== 'admin' && { userId }),
        page: currentPage.toString(),
        limit: '10',
        ...(userType !== 'all' && { type: userType }),
        ...(filters.approved !== 'all' && { approved: filters.approved === 'approved' ? 'true' : 'false' }),
      });

      const response = await fetch(`/api/reviews?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }

      let fetchedReviews = data.reviews;

      // Apply client-side filters
      if (filters.rating) {
        fetchedReviews = fetchedReviews.filter((review: ReviewData) => review.rating === filters.rating);
      }

      // Apply sorting
      fetchedReviews.sort((a: ReviewData, b: ReviewData) => {
        switch (filters.sortBy) {
          case 'oldest':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'rating_high':
            return b.rating - a.rating;
          case 'rating_low':
            return a.rating - b.rating;
          case 'newest':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      if (resetPage) {
        setReviews(fetchedReviews);
        setPage(1);
      } else {
        setReviews(prev => [...prev, ...fetchedReviews]);
      }

      setHasMore(data.pagination.page < data.pagination.totalPages);
      
      // Calculate stats
      calculateStats(resetPage ? fetchedReviews : [...reviews, ...fetchedReviews]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (reviewList: ReviewData[]) => {
    const approved = reviewList.filter(r => r.isApproved);
    const pending = reviewList.filter(r => !r.isApproved);
    
    const distribution: { [key: number]: number } = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    approved.forEach(review => {
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });

    const averageRating = approved.length > 0 
      ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length 
      : 0;

    setStats({
      totalReviews: reviewList.length,
      averageRating: parseFloat(averageRating.toFixed(1)),
      approvedReviews: approved.length,
      pendingReviews: pending.length,
      ratingDistribution: distribution
    });
  };

  useEffect(() => {
    fetchReviews(true);
  }, [userId, userType, filters]);

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchReviews(false);
  };

  const handleFilterChange = (newFilters: Partial<ReviewFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (loading && reviews.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
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
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={() => fetchReviews(true)}
          className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stats Summary */}
      {stats && userType === 'received' && (
        <div className="bg-white rounded-lg border p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.averageRating || '0'}</div>
              <div className="text-sm text-gray-500">Average Rating</div>
              <StarRating rating={stats.averageRating} readonly size="small" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.approvedReviews}</div>
              <div className="text-sm text-gray-500">Approved Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingReviews}</div>
              <div className="text-sm text-gray-500">Pending Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.totalReviews}</div>
              <div className="text-sm text-gray-500">Total Reviews</div>
            </div>
          </div>

          {/* Rating Distribution */}
          {stats.approvedReviews > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Rating Distribution</h4>
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = stats.ratingDistribution[rating] || 0;
                  const percentage = stats.approvedReviews > 0 ? (count / stats.approvedReviews) * 100 : 0;
                  
                  return (
                    <div key={rating} className="flex items-center space-x-2 text-sm">
                      <span className="w-4 text-right">{rating}</span>
                      <StarIcon className="h-3 w-3 text-yellow-400" />
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-400 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="w-8 text-gray-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
        >
          <FunnelIcon className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {showFilters ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <select
                value={filters.rating || ''}
                onChange={(e) => handleFilterChange({ 
                  rating: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Ratings</option>
                {[5, 4, 3, 2, 1].map(rating => (
                  <option key={rating} value={rating}>{rating} Stars</option>
                ))}
              </select>
            </div>

            {/* Approval Filter */}
            {showModeration && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.approved}
                  onChange={(e) => handleFilterChange({ 
                    approved: e.target.value as 'all' | 'approved' | 'pending' 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Reviews</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            )}

            {/* Sort Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange({ 
                  sortBy: e.target.value as ReviewFilters['sortBy']
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="rating_high">Highest Rating</option>
                <option value="rating_low">Lowest Rating</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="text-gray-400 mb-4">
            <StarIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
          <p className="text-gray-500">
            {userType === 'given' 
              ? "You haven't written any reviews yet."
              : "No reviews have been written yet."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showModeration={showModeration}
              showReviewee={userType === 'given'}
              currentUserId={currentUserId}
              onModerationAction={onModerationAction}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Load More Reviews
          </button>
        </div>
      )}

      {/* Loading More */}
      {loading && reviews.length > 0 && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
        </div>
      )}
    </div>
  );
};

export default ReviewList;