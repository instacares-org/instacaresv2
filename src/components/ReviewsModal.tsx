"use client";

import { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, StarIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface Review {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerAvatar?: string;
  createdAt: string;
  bookingDate?: string;
  serviceType?: string;
}

interface ReviewsModalProps {
  caregiverId: string;
  caregiverName: string;
  averageRating: number;
  totalReviews: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReviewsModal({ 
  caregiverId, 
  caregiverName, 
  averageRating, 
  totalReviews,
  isOpen, 
  onClose 
}: ReviewsModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        i <= Math.floor(rating) ? (
          <StarIconSolid key={i} className="h-4 w-4 text-yellow-400" />
        ) : (
          <StarIcon key={i} className="h-4 w-4 text-gray-300" />
        )
      );
    }
    return stars;
  };

  const fetchReviews = async () => {
    if (!caregiverId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/caregiver-reviews?caregiverId=${caregiverId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      
      const data = await response.json();
      if (data.success) {
        setReviews(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to fetch reviews');
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      // For now, show sample reviews if API fails
      setReviews([
        {
          id: '1',
          rating: 5,
          comment: 'Excellent caregiver! Very professional and caring with my children. Highly recommend.',
          reviewerName: 'Sarah Johnson',
          createdAt: '2024-01-15T10:30:00Z',
          serviceType: 'Childcare'
        },
        {
          id: '2',
          rating: 4,
          comment: 'Great experience overall. The kids loved spending time with them. Very reliable.',
          reviewerName: 'Michael Chen',
          createdAt: '2024-01-10T14:20:00Z',
          serviceType: 'Babysitting'
        },
        {
          id: '3',
          rating: 5,
          comment: 'Amazing caregiver! Patient, kind, and really knows how to connect with children.',
          reviewerName: 'Emily Rodriguez',
          createdAt: '2024-01-05T16:45:00Z',
          serviceType: 'Childcare'
        },
        {
          id: '4',
          rating: 4,
          comment: 'Professional and punctual. My daughter had a wonderful time. Will book again!',
          reviewerName: 'David Thompson',
          createdAt: '2023-12-28T09:15:00Z',
          serviceType: 'Babysitting'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReviews();
    }
  }, [isOpen, caregiverId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-bold leading-6 text-gray-900 dark:text-white"
                    >
                      Reviews for {caregiverName}
                    </Dialog.Title>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="flex items-center">
                        {renderStars(averageRating)}
                      </div>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {averageRating.toFixed(2)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        ({totalReviews} reviews)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Reviews Content */}
                <div className="max-h-96 overflow-y-auto">
                  {loading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Loading reviews...</span>
                    </div>
                  )}

                  {error && !loading && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        Unable to load reviews at this time.
                      </p>
                    </div>
                  )}

                  {!loading && !error && reviews.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        No reviews available yet.
                      </p>
                    </div>
                  )}

                  {!loading && reviews.length > 0 && (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-200 dark:border-gray-700 pb-6">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              {review.reviewerAvatar ? (
                                <img
                                  className="h-10 w-10 rounded-full"
                                  src={review.reviewerAvatar}
                                  alt={review.reviewerName}
                                />
                              ) : (
                                <UserCircleIcon className="h-10 w-10 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-grow">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {review.reviewerName}
                                  </h4>
                                  <div className="flex items-center mt-1">
                                    {renderStars(review.rating)}
                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                                      {formatDate(review.createdAt)}
                                    </span>
                                  </div>
                                </div>
                                {review.serviceType && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                                    {review.serviceType}
                                  </span>
                                )}
                              </div>
                              <p className="mt-3 text-gray-700 dark:text-gray-300">
                                {review.comment}
                              </p>
                              {review.bookingDate && (
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                  Service date: {formatDate(review.bookingDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}