"use client";

import { useState } from 'react';
import BabysittingCaregiverCard from '@/components/BabysittingCaregiverCard';

export default function DemoBabysittingCard() {
  const [serviceMode, setServiceMode] = useState<'daycare' | 'babysitting'>('babysitting');

  // Mock caregiver data
  const mockCaregivers = [
    {
      id: '1',
      name: 'Sarah Johnson',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      rating: 4.8,
      reviewCount: 24,
      hourlyRate: 22,
      babysittingRate: 28,
      offersBabysitting: true,
      distance: '3.2 km',
      numericDistance: 3.2,
      address: {
        street: '123 Main St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1'
      },
      city: 'Toronto',
      bio: 'Experienced childcare provider with 8+ years working with children of all ages. CPR certified and First Aid trained.',
      experienceYears: 8,
      estimatedTravel: 15,
      babysittingNotes: 'Prefer 4+ hour bookings, weekends available',
      specialties: ['Infants', 'Toddlers', 'Special Needs'],
      verified: true,
      stripeOnboarded: true,
      canReceivePayments: true,
      availability: 'Available today',
      verification: {
        backgroundCheck: true,
        verificationScore: 98
      }
    },
    {
      id: '2',
      name: 'Michael Chen',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      rating: 4.9,
      reviewCount: 38,
      hourlyRate: 25,
      babysittingRate: 32,
      offersBabysitting: true,
      distance: '5.7 km',
      numericDistance: 5.7,
      address: {
        street: '456 Oak Ave',
        city: 'Mississauga',
        province: 'ON',
        postalCode: 'L5B 2G2'
      },
      city: 'Mississauga',
      bio: 'Former elementary school teacher turned full-time caregiver. Specializing in educational activities and creative play.',
      experienceYears: 12,
      estimatedTravel: 20,
      babysittingNotes: 'Happy to help with homework and meal prep',
      specialties: ['School Age', 'Homework Help', 'Educational Activities', 'Arts & Crafts'],
      verified: true,
      stripeOnboarded: true,
      canReceivePayments: true,
      availability: 'Available this week',
      verification: {
        backgroundCheck: true,
        verificationScore: 95
      }
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      rating: 5.0,
      reviewCount: 16,
      hourlyRate: 20,
      babysittingRate: 0,
      offersBabysitting: false,
      distance: '4.1 km',
      numericDistance: 4.1,
      address: {
        street: '789 Maple Rd',
        city: 'Brampton',
        province: 'ON',
        postalCode: 'L6T 3H3'
      },
      city: 'Brampton',
      bio: 'Running a licensed home daycare for 5 years. Small group sizes ensure personalized attention for each child.',
      experienceYears: 5,
      specialties: ['Toddlers', 'Preschool', 'Healthy Meals'],
      verified: true,
      stripeOnboarded: true,
      canReceivePayments: true,
      availability: 'Available tomorrow',
      verification: {
        backgroundCheck: false,
        verificationScore: 92
      }
    },
    {
      id: '4',
      name: 'David Thompson',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      rating: 4.7,
      reviewCount: 31,
      hourlyRate: 0,
      babysittingRate: 30,
      offersBabysitting: true,
      distance: '2.8 km',
      numericDistance: 2.8,
      address: {
        city: 'Mobile Service',
        province: 'ON'
      },
      city: 'Mobile Service Only',
      bio: 'Professional babysitter with pediatric nursing background. Available for evenings and overnight care.',
      experienceYears: 6,
      estimatedTravel: 12,
      babysittingNotes: 'Available evenings and weekends, overnight care available',
      specialties: ['Evening Care', 'Overnight Care', 'Infants', 'Medical Background'],
      verified: true,
      stripeOnboarded: false,
      canReceivePayments: false,
      availability: 'Contact for availability',
      verification: {
        backgroundCheck: true,
        verificationScore: 97
      }
    }
  ];

  const handleBookNow = (caregiverId: string, mode: 'daycare' | 'babysitting') => {
    alert(`Booking ${mode} with caregiver ID: ${caregiverId}`);
  };

  const handleSwitchService = (caregiverId: string, newMode: 'daycare' | 'babysitting') => {
    setServiceMode(newMode);
    alert(`Switched to ${newMode} for caregiver ID: ${caregiverId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Babysitting Card Component Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Preview of the new caregiver card with service type indicators
          </p>
        </div>

        {/* Service Mode Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Toggle Service Mode (affects all cards):
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setServiceMode('babysitting')}
              className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                serviceMode === 'babysitting'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }`}
            >
              <div className="text-4xl mb-2">👶</div>
              <div className="font-semibold text-gray-900 dark:text-white">Babysitting</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Caregiver comes to your home
              </div>
            </button>

            <button
              onClick={() => setServiceMode('daycare')}
              className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                serviceMode === 'daycare'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="text-4xl mb-2">🏠</div>
              <div className="font-semibold text-gray-900 dark:text-white">Daycare</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Take child to caregiver's facility
              </div>
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCaregivers
            .filter(c => {
              // Filter based on service mode
              if (serviceMode === 'babysitting') {
                return c.offersBabysitting;
              } else {
                return c.hourlyRate > 0;
              }
            })
            .map(caregiver => (
              <BabysittingCaregiverCard
                key={caregiver.id}
                caregiver={caregiver}
                serviceMode={serviceMode}
                onBookNow={handleBookNow}
                onSwitchService={handleSwitchService}
              />
            ))}
        </div>

        {/* Legend */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Visual Indicators Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2">
                Babysitting Mode:
              </h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Purple header and accents</li>
                <li>• Home icon (🏠)</li>
                <li>• Shows travel time estimate</li>
                <li>• Displays babysitter's notes</li>
                <li>• Higher rate (travel included)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                Daycare Mode:
              </h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Blue header and accents</li>
                <li>• Building icon (🏢)</li>
                <li>• Shows facility address</li>
                <li>• Distance from parent</li>
                <li>• Standard daycare rate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
