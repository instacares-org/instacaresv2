"use client";

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, StarIcon, MapPinIcon, ClockIcon, ShieldCheckIcon, PhoneIcon, EnvelopeIcon, CalendarIcon, CurrencyDollarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import CaregiverProfileImage from './CaregiverProfileImage';
import BookingModal from './BookingModal';
import ReviewsModal from './ReviewsModal';
import { Caregiver, AvailabilitySlot } from './CaregiverCard';

interface CaregiverPhoto {
  id: string;
  url: string;
  caption: string;
  isProfile: boolean;
  createdAt: string;
}

interface CaregiverDetailModalProps {
  caregiver: Caregiver;
  isOpen: boolean;
  onClose: () => void;
}

export default function CaregiverDetailModal({ caregiver, isOpen, onClose }: CaregiverDetailModalProps) {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [daycarePhotos, setDaycarePhotos] = useState<CaregiverPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<CaregiverPhoto | null>(null);
  
  // Fetch detailed availability and photos when modal opens
  useEffect(() => {
    if (isOpen && caregiver.caregiverId) {
      fetchAvailabilitySlots();
      fetchDaycarePhotos();
    }
  }, [isOpen, caregiver.caregiverId]);
  
  const fetchAvailabilitySlots = async () => {
    try {
      setAvailabilityLoading(true);
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Next 30 days for detail modal
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await fetch(
        `/api/availability/slots?caregiverId=${caregiver.caregiverId}&startDate=${startDate}&endDate=${endDateStr}`
      );
      const data = await response.json();
      
      if (data.success) {
        setAvailabilitySlots(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching availability slots:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const fetchDaycarePhotos = async () => {
    try {
      setPhotosLoading(true);
      console.log('🔍 Fetching photos for caregiver:', caregiver.caregiverId);
      const response = await fetch(`/api/caregiver/${caregiver.caregiverId}/photos`);
      console.log('📸 Photo API response status:', response.status);
      const data = await response.json();
      console.log('📸 Photo API response data:', data);
      
      if (data.success && data.caregiver?.photos) {
        console.log('✅ Setting photos:', data.caregiver.photos);
        setDaycarePhotos(data.caregiver.photos);
      } else {
        console.log('⚠️ No photos in response or unsuccessful');
      }
    } catch (error) {
      console.error('❌ Error fetching daycare photos:', error);
    } finally {
      setPhotosLoading(false);
    }
  };

  // Format time to user-friendly format
  const formatTime = (timeString: string) => {
    try {
      // Handle different time formats
      let time;
      if (timeString.includes('T')) {
        // ISO format: 2025-08-23T13:00:00.000Z
        time = new Date(timeString);
      } else {
        // Time only format: 13:00:00
        time = new Date(`2000-01-01T${timeString}`);
      }
      
      return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      // Fallback to original string if parsing fails
      return timeString;
    }
  };

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

  const formatAvailabilitySlots = () => {
    if (availabilityLoading) {
      return (
        <div className="text-gray-500 italic">Loading availability...</div>
      );
    }
    
    if (!availabilitySlots || availabilitySlots.length === 0) {
      return (
        <div className="text-gray-500 italic">No availability slots posted yet</div>
      );
    }

    const groupedSlots = availabilitySlots.reduce((groups, slot) => {
      const date = new Date(slot.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(slot);
      return groups;
    }, {} as Record<string, AvailabilitySlot[]>);

    return (
      <div className="space-y-3">
        {Object.entries(groupedSlots).map(([date, slots]) => (
          <div key={date} className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-1.5 text-sm">{date}</h4>
            <div className="space-y-1.5">
              {slots.map((slot) => (
                <div key={slot.id} className="flex justify-between items-center bg-white dark:bg-gray-600 p-1.5 rounded text-xs">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="h-3 w-3 text-gray-500" />
                    <span className="font-medium">
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      slot.availableSpots > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {slot.availableSpots}/{slot.totalCapacity}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${slot.baseRate}/hr
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-white/20 backdrop-blur-md pointer-events-none" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto pointer-events-none">
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-4 text-left align-middle shadow-xl transition-all pointer-events-auto">
                  <div className="flex justify-between items-start mb-4">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-bold leading-6 text-gray-900 dark:text-white"
                    >
                      Caregiver Details
                    </Dialog.Title>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      onClick={onClose}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left Column - Profile Info */}
                    <div className="space-y-4">
                      {/* Profile Image and Basic Info */}
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="relative w-20 h-20 rounded-full overflow-hidden">
                            <CaregiverProfileImage
                              name={caregiver.name}
                              id={caregiver.id}
                              imageUrl={caregiver.profilePhoto || caregiver.image}
                              fill={true}
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {caregiver.name}
                          </h2>
                          {caregiver.email && (
                            <div className="flex items-center mt-1 text-gray-600 dark:text-gray-400">
                              <EnvelopeIcon className="h-4 w-4 mr-1" />
                              <span className="text-sm">{caregiver.email}</span>
                            </div>
                          )}
                          {caregiver.phone && (
                            <div className="flex items-center mt-1 text-gray-600 dark:text-gray-400">
                              <PhoneIcon className="h-4 w-4 mr-1" />
                              <span className="text-sm">{caregiver.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center mt-1 text-gray-600 dark:text-gray-400">
                            <MapPinIcon className="h-4 w-4 mr-1" />
                            <span className="text-sm">
                              {caregiver.address?.city && caregiver.address?.province 
                                ? `${caregiver.address.city}, ${caregiver.address.province}` 
                                : caregiver.city || caregiver.distance}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Rating and Reviews */}
                      <div 
                        className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                        onClick={() => setShowReviewsModal(true)}
                      >
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Rating & Reviews</h3>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center">
                            {renderStars(caregiver.rating)}
                          </div>
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            {caregiver.rating.toFixed(2)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            ({caregiver.reviewCount} reviews)
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Click to view all reviews
                        </p>
                      </div>

                      {/* Pricing */}
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Pricing</h3>
                        <div className="flex items-center space-x-2">
                          <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            ${caregiver.hourlyRate}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">/hour</span>
                        </div>
                      </div>

                      {/* Specialties */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {caregiver.specialties.map((specialty) => (
                            <span
                              key={specialty}
                              className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Verification Status */}
                      {(caregiver.verified || caregiver.verification) && (
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Verification</h3>
                          <div className="space-y-2">
                            {caregiver.verified && (
                              <div className="flex items-center space-x-2">
                                <ShieldCheckIcon className="h-5 w-5 text-teal-600" />
                                <span className="text-sm text-teal-600 font-medium">Verified Caregiver</span>
                              </div>
                            )}
                            {caregiver.verification?.backgroundCheck && (
                              <div className="flex items-center space-x-2">
                                <ShieldCheckIcon className="h-5 w-5 text-rose-600" />
                                <span className="text-sm text-rose-600 font-medium">Background Check Completed</span>
                              </div>
                            )}
                            {caregiver.verification?.verificationScore && caregiver.verification.verificationScore >= 90 && (
                              <div className="flex items-center space-x-2">
                                <StarIcon className="h-5 w-5 text-amber-600" />
                                <span className="text-sm text-amber-600 font-medium">Top Rated Caregiver</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Experience */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Experience</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{caregiver.experience}</p>
                      </div>
                    </div>

                    {/* Right Column - Availability and Description */}
                    <div className="space-y-4">
                      {/* Description */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">About Me</h3>
                        {caregiver.experienceYears && caregiver.experienceYears > 0 && (
                          <div className="mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                              {caregiver.experienceYears} year{caregiver.experienceYears !== 1 ? 's' : ''} of experience
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                          {caregiver.bio || caregiver.description || 'No bio available.'}
                        </p>
                      </div>

                      {/* Availability Status */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Availability Status</h3>
                        <div className={`flex items-center space-x-2 ${
                          caregiver.availability === "No Availability Posted Yet" 
                            ? 'text-gray-500' 
                            : caregiver.availability.includes("Available today") || caregiver.availability.includes("Available tomorrow")
                            ? 'text-green-600'
                            : caregiver.availability.includes("Available this week")
                            ? 'text-blue-600'  
                            : 'text-orange-600'
                        }`}>
                          <ClockIcon className="h-5 w-5" />
                          <span className="font-medium">{caregiver.availability}</span>
                        </div>
                      </div>

                      {/* Available Time Slots */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Available Time Slots</h3>
                        <div className="max-h-64 overflow-y-auto">
                          {formatAvailabilitySlots()}
                        </div>
                      </div>

                      {/* Daycare Photos */}
                      {console.log('🎨 Rendering photos section. Photos array:', daycarePhotos)}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">Daycare Photos</h3>
                          {daycarePhotos.length > 0 && (
                            <button
                              onClick={() => setShowPhotoGallery(!showPhotoGallery)}
                              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium"
                            >
                              {showPhotoGallery ? 'Hide Photos' : `View All (${daycarePhotos.length})`}
                            </button>
                          )}
                        </div>
                        
                        {photosLoading ? (
                          <div className="text-gray-500 italic text-sm">Loading photos...</div>
                        ) : daycarePhotos.length === 0 ? (
                          <div className="text-gray-500 italic text-sm">No photos uploaded yet</div>
                        ) : showPhotoGallery ? (
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {daycarePhotos.map((photo) => (
                              <div 
                                key={photo.id} 
                                className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group cursor-pointer"
                                onClick={() => setSelectedPhoto(photo)}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.caption || 'Daycare photo'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                {photo.caption && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {photo.caption}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            {daycarePhotos.slice(0, 3).map((photo, index) => (
                              <div 
                                key={photo.id} 
                                className="relative w-16 h-12 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-rose-500 transition-all"
                                onClick={() => setSelectedPhoto(photo)}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.caption || 'Daycare photo'}
                                  className="w-full h-full object-cover"
                                />
                                {index === 2 && daycarePhotos.length > 3 && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                                    +{daycarePhotos.length - 3}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition"
                      onClick={onClose}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="px-6 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition"
                      onClick={() => {
                        setShowBookingModal(true);
                      }}
                    >
                      Book Now
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          caregiver={caregiver}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      {/* Reviews Modal */}
      {showReviewsModal && (
        <ReviewsModal
          caregiverId={caregiver.caregiverId || caregiver.id}
          caregiverName={caregiver.name}
          averageRating={caregiver.rating}
          totalReviews={caregiver.reviewCount}
          isOpen={showReviewsModal}
          onClose={() => setShowReviewsModal(false)}
        />
      )}

      {/* Full-Screen Photo Viewer */}
      <Transition appear show={!!selectedPhoto} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setSelectedPhoto(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/90" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative w-full max-w-5xl">
                  {/* Close button */}
                  <button
                    type="button"
                    className="absolute top-4 right-4 z-10 rounded-full bg-white/10 backdrop-blur-sm p-2 text-white hover:bg-white/20 transition-colors"
                    onClick={() => setSelectedPhoto(null)}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>

                  {/* Photo display */}
                  {selectedPhoto && (
                    <div className="relative">
                      <img
                        src={selectedPhoto.url}
                        alt={selectedPhoto.caption || 'Daycare photo'}
                        className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                      />
                      
                      {/* Caption */}
                      {selectedPhoto.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-lg">
                          <p className="text-white text-lg font-medium">
                            {selectedPhoto.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Navigation buttons for multiple photos */}
                  {daycarePhotos.length > 1 && selectedPhoto && (
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                      <button
                        className="pointer-events-auto ml-4 rounded-full bg-white/10 backdrop-blur-sm p-2 text-white hover:bg-white/20 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = daycarePhotos.findIndex(p => p.id === selectedPhoto.id);
                          const prevIndex = currentIndex === 0 ? daycarePhotos.length - 1 : currentIndex - 1;
                          setSelectedPhoto(daycarePhotos[prevIndex]);
                        }}
                      >
                        <ChevronLeftIcon className="h-6 w-6" />
                      </button>
                      <button
                        className="pointer-events-auto mr-4 rounded-full bg-white/10 backdrop-blur-sm p-2 text-white hover:bg-white/20 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIndex = daycarePhotos.findIndex(p => p.id === selectedPhoto.id);
                          const nextIndex = currentIndex === daycarePhotos.length - 1 ? 0 : currentIndex + 1;
                          setSelectedPhoto(daycarePhotos[nextIndex]);
                        }}
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </button>
                    </div>
                  )}

                  {/* Photo counter */}
                  {daycarePhotos.length > 1 && selectedPhoto && (
                    <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm">
                      {daycarePhotos.findIndex(p => p.id === selectedPhoto.id) + 1} / {daycarePhotos.length}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}