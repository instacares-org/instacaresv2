"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, MapPinIcon, ClockIcon, ShieldCheckIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import CaregiverProfileImage from './CaregiverProfileImage';
import { BabysitterCardData } from './BabysitterCard';

interface BabysitterDetailModalProps {
  babysitter: BabysitterCardData;
  isOpen: boolean;
  onClose: () => void;
  onBook?: () => void;
}

export default function BabysitterDetailModal({ babysitter, isOpen, onClose, onBook }: BabysitterDetailModalProps) {
  const name = `${babysitter.firstName} ${babysitter.lastName}`;
  const rating = babysitter.averageRating ?? 0;

  const hasBadge = (type: string) => babysitter.trustBadges.includes(type);

  const renderStars = (r: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <StarIconSolid
          key={i}
          className={`h-4 w-4 ${i <= Math.floor(r) ? 'text-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
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
                    Babysitter Profile
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
                            name={name}
                            id={babysitter.id}
                            imageUrl={babysitter.avatar || ''}
                            fill={true}
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                      <div className="flex-grow">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {name}
                        </h2>
                        <div className="flex items-center mt-1 text-gray-600 dark:text-gray-400">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          <span className="text-sm">
                            {babysitter.city}{babysitter.state ? `, ${babysitter.state}` : ''}
                          </span>
                        </div>
                        {/* Babysitter badge */}
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-violet-600 text-white">
                            Babysitter
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rating and Reviews */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Rating & Reviews</h3>
                      {rating > 0 ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center">
                            {renderStars(rating)}
                          </div>
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            {rating.toFixed(2)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            ({babysitter.reviewCount} reviews)
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">New - no reviews yet</p>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Pricing</h3>
                      <div className="flex items-center space-x-2">
                        <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          ${babysitter.hourlyRate}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">/hour</span>
                      </div>
                      {babysitter.acceptsOnsitePayment && (
                        <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                          Accepts on-site payment (cash/e-transfer)
                        </p>
                      )}
                    </div>

                    {/* Trust Badges */}
                    {babysitter.trustBadges.length > 0 && (
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Verifications</h3>
                        <div className="flex flex-wrap gap-2">
                          {hasBadge('VERIFIED_ID') && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                              ID Verified
                            </span>
                          )}
                          {hasBadge('BACKGROUND_CHECKED') && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                              Background Checked
                            </span>
                          )}
                          {hasBadge('CPR_CERTIFIED') && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                              CPR Certified
                            </span>
                          )}
                          {hasBadge('ECE_TRAINED') && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                              ECE Trained
                            </span>
                          )}
                          {hasBadge('PHONE_VERIFIED') && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                              Phone Verified
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Bio & Availability */}
                  <div className="space-y-4">
                    {/* About / Bio */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">About Me</h3>
                      {babysitter.experienceYears > 0 && (
                        <div className="mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            {babysitter.experienceYears} year{babysitter.experienceYears !== 1 ? 's' : ''} of experience
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                        {babysitter.bio || 'No bio available.'}
                      </p>
                    </div>

                    {/* Availability */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Availability</h3>
                      {babysitter.availability && babysitter.availability.length > 0 ? (
                        <div className="space-y-1.5">
                          {babysitter.availability.map((slot, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                              <div className="flex items-center space-x-2">
                                <ClockIcon className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-gray-900 dark:text-white">{slot.day}</span>
                              </div>
                              <span className="text-gray-600 dark:text-gray-400">
                                {slot.startTime} - {slot.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Contact for availability
                        </p>
                      )}
                    </div>

                    {/* Experience Tags */}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Highlights</h3>
                      <div className="flex flex-wrap gap-2">
                        {babysitter.experienceYears > 0 && (
                          <span className="px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                            {babysitter.experienceYears}yr experience
                          </span>
                        )}
                        {babysitter.acceptsOnsitePayment && (
                          <span className="px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                            On-site payment
                          </span>
                        )}
                        {babysitter.stripeOnboarded && (
                          <span className="px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                            Online payment
                          </span>
                        )}
                      </div>
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
                    className="px-6 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition"
                    onClick={() => {
                      onBook?.();
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
  );
}
