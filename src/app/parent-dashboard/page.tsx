'use client';

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import SignupModal from '@/components/SignupModal';
import {
  User,
  Calendar,
  Bell,
  Settings,
  Plus,
  Edit2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Save,
  X,
  Baby,
  Star,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  HelpCircle,
  Heart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Chat from '../../components/Chat';
import ChatWebSocket from '../../components/ChatWebSocket';
import { formatCAD } from '@/lib/currency';
import { addCSRFHeader } from '@/lib/csrf';
import OrganizedMessagesContainer from '../../components/OrganizedMessagesContainer';
import { SocketProvider } from '../../context/SocketContext';
import { CSRFTokenProvider } from '../../components/security/CSRFTokenProvider';
import NotificationInitializer from '../../components/NotificationInitializer';
import { useUnreadMessageCount } from '../../hooks/useUnreadMessageCount';
import { useBookingUnreadCounts } from '../../hooks/useBookingUnreadCounts';
import { useNotificationStorage } from '../../hooks/useNotificationStorage';
import ReviewForm, { ReviewFormData } from '../../components/ReviewForm';
import ReviewList from '../../components/ReviewList';
import ChildProfile from '../../components/ChildProfile';
import ThemeToggle from '../../components/ThemeToggle';
import UserSupportTickets from '../../components/UserSupportTickets';
import CaregiverCard, { Caregiver } from '../../components/CaregiverCard';
import BabysitterCard, { BabysitterCardData } from '../../components/BabysitterCard';
import ExtensionPaymentBanner from '../../components/ExtensionPaymentBanner';
import { useUserTimezone } from '../../hooks/useUserTimezone';
// Dynamic import for BookingChatModal to reduce initial bundle size (socket.io-client)
const BookingChatModal = dynamic(() => import('../../components/BookingChatModal'), {
  loading: () => null,
  ssr: false
});

interface Allergy {
  id?: string;
  name: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  reaction: string;
  treatment: string;
}

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  prescribedBy: string;
}

interface MedicalCondition {
  id?: string;
  condition: string;
  description: string;
  treatment: string;
  doctorContact: string;
}

interface EmergencyContact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  canPickup: boolean;
}

interface Child {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: Allergy[];
  medications: Medication[];
  medicalConditions: MedicalCondition[];
  emergencyMedicalInfo: string;
  bloodType: string;
  emergencyContacts: EmergencyContact[];
  dietaryRestrictions: string[];
  specialInstructions: string;
  pickupInstructions: string;
  photoUrl?: string;
}

interface Booking {
  id: string;
  caregiverId: string;
  caregiverUserId: string; // User ID for chat
  caregiverName: string;
  caregiverPhoto?: string;
  caregiverRating: number | null;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalAmount: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  children: string[];
  address: string;
  notes?: string;
  reviewGiven?: boolean;
  unreadMessages?: number;
}

interface Notification {
  id: string;
  type: 'booking' | 'caregiver' | 'payment' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface ParentProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    apartment?: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  profilePhoto?: string;
  memberSince: string;
  totalBookings: number;
  children: Child[];
}

// Saved Providers Tab
function SavedProvidersTab({ userId }: { userId: string }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.data?.favorites || []);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleUnfavorite = useCallback((_providerId: string, isFavorited: boolean) => {
    if (!isFavorited) {
      // Remove from list when unfavorited
      setFavorites(prev => prev.filter(f => f.provider.id !== _providerId));
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent mx-auto"></div>
        <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm">Loading saved providers...</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <Heart className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No saved providers yet</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Browse caregivers and babysitters and click the heart icon to save your favorites.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
        >
          Browse Providers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Saved Providers</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{favorites.length} provider{favorites.length !== 1 ? 's' : ''} saved</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map((fav) => {
          const provider = fav.provider;
          if (provider.isCaregiver && provider.caregiver) {
            const caregiverData: Caregiver = {
              id: provider.id,
              caregiverId: provider.caregiver.id,
              name: provider.name || `${provider.profile?.firstName || ''} ${provider.profile?.lastName || ''}`.trim(),
              image: provider.profile?.avatar || provider.image || '',
              profilePhoto: provider.profile?.avatar || undefined,
              rating: provider.caregiver.averageRating || 0,
              reviewCount: provider._count?.receivedReviews || 0,
              hourlyRate: provider.caregiver.hourlyRate || 0,
              distance: '',
              description: provider.caregiver.bio || '',
              specialties: provider.caregiver.specialties || [],
              location: { lat: 0, lng: 0, address: '' },
              availability: '',
              verified: false,
              experience: `${provider.caregiver.experienceYears || 0} years`,
              city: provider.profile?.city || '',
            };
            return (
              <CaregiverCard
                key={fav.id}
                caregiver={caregiverData}
                isFavorited={true}
                onFavoriteToggle={handleUnfavorite}
              />
            );
          }
          if (provider.isBabysitter && provider.babysitter) {
            const babysitterData: BabysitterCardData = {
              id: provider.babysitter.id,
              userId: provider.id,
              type: 'babysitter',
              firstName: provider.profile?.firstName || '',
              lastName: provider.profile?.lastName || '',
              avatar: provider.profile?.avatar || null,
              city: provider.profile?.city || '',
              state: provider.profile?.state || '',
              bio: provider.babysitter.bio || '',
              experienceYears: provider.babysitter.experienceYears || 0,
              hourlyRate: provider.babysitter.hourlyRate || 0,
              averageRating: provider.babysitter.averageRating || null,
              reviewCount: provider._count?.receivedReviews || 0,
              trustBadges: [],
              acceptsOnsitePayment: provider.babysitter.acceptsOnsitePayment || false,
              stripeOnboarded: provider.babysitter.stripeOnboarded || false,
              availability: [],
            };
            return (
              <BabysitterCard
                key={fav.id}
                babysitter={babysitterData}
                isFavorited={true}
                onFavoriteToggle={handleUnfavorite}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

const ParentDashboardContent: React.FC = () => {
  const { user, loading: authLoading, isAuthenticated, isParent, logout, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'bookings' | 'messages' | 'notifications' | 'children' | 'saved' | 'support'>('overview');
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [showChildProfile, setShowChildProfile] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const { timezone: userTimezone } = useUserTimezone();

  // Chat modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedChatBooking, setSelectedChatBooking] = useState<Booking | null>(null);

  // Review states
  const [showReviewForm, setShowReviewForm] = useState(false);

  // OAuth profile completion modal state
  const [showOAuthCompletionModal, setShowOAuthCompletionModal] = useState(false);
  const [profileCompletedInSession, setProfileCompletedInSession] = useState(false);

  // Show OAuth profile completion modal when user needs to complete their profile
  useEffect(() => {
    // Check URL parameters for OAuth redirect (oauth=true&userType=parent)
    const isOAuthCallback = searchParams.get('oauth') === 'true';
    const urlUserType = searchParams.get('userType');

    console.log('ParentDashboard OAuth check:', {
      isAuthenticated,
      needsProfileCompletion: user?.needsProfileCompletion,
      userId: user?.id,
      userEmail: user?.email,
      profileCompletedInSession,
      isOAuthCallback,
      urlUserType
    });

    // Clean up URL parameters after detecting OAuth callback (regardless of whether modal shows)
    if (isOAuthCallback) {
      window.history.replaceState({}, '', '/parent-dashboard');
    }

    // Show modal ONLY if:
    // 1. User is authenticated
    // 2. User ACTUALLY needs profile completion (not just because of OAuth params)
    // 3. User hasn't already completed profile in this session
    // 4. Modal isn't already showing
    // NOTE: OAuth params are only used as context, but modal only shows if needsProfileCompletion is true
    const shouldShowModal = isAuthenticated &&
      user?.needsProfileCompletion === true &&
      !profileCompletedInSession &&
      !showOAuthCompletionModal;

    if (shouldShowModal) {
      console.log('Opening OAuth profile completion modal from ParentDashboard');
      setShowOAuthCompletionModal(true);
    }
  }, [isAuthenticated, user?.needsProfileCompletion, user?.id, user?.email, profileCompletedInSession, showOAuthCompletionModal, searchParams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the notification dropdown
      if (showNotificationDropdown && !target.closest('.notification-dropdown-container')) {
        setShowNotificationDropdown(false);
      }
    };

    if (showNotificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationDropdown]);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  // Check URL parameter to set initial tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'profile', 'bookings', 'messages', 'notifications', 'children', 'support'].includes(tabParam)) {
      setActiveTab(tabParam as 'overview' | 'profile' | 'bookings' | 'messages' | 'notifications' | 'children' | 'saved' | 'support');
      console.log('🔗 URL tab parameter detected:', tabParam, '- switching to tab');
      
      // Clear the URL parameter to keep the URL clean
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', url.toString());
    }
  }, [searchParams]);
  
  // Use real notification storage
  const {
    notifications,
    unreadCount: realUnreadCount,
    markAsRead: markNotificationAsRead,
    markAllAsRead,
    clearAll,
    addMessageNotification,
    addBookingNotification,
    addSystemNotification
  } = useNotificationStorage();

  // Use real message count hook
  const {
    unreadCount: realUnreadMessageCount,
    refreshCount: refreshMessageCount,
    decrementCount: decrementMessageCount
  } = useUnreadMessageCount();

  // Use booking-specific unread counts for Message button badges
  const {
    getCountForBooking,
    clearCountForBooking,
    refreshCounts: refreshBookingUnreadCounts
  } = useBookingUnreadCounts();

  // Redirect if not authenticated or not a parent
  // Add a small delay to allow session to fully initialize on page refresh
  useEffect(() => {
    if (!authLoading) {
      // Wait a moment for session to be fully verified
      const timer = setTimeout(() => {
        if (!isAuthenticated || !isParent) {
          router.push('/');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, isParent, router]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading]);
  // Fetch children from API
  const fetchChildren = useCallback(async () => {
    if (!user) return [];

    try {
      const response = await fetch('/api/children');

      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching children:', error);
      return [];
    }
  }, [user]);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    if (!user) return [];

    try {
      console.log('🔍 Fetching bookings for user:', user.id);
      const response = await fetch(`/api/bookings?userId=${user.id}&userType=parent`);

      console.log('📡 Booking API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Booking API error:', errorText);
        throw new Error('Failed to fetch bookings');
      }

      const result = await response.json();
      console.log('📊 Booking API result:', result);
      
      if (result.success && result.data) {
        // Transform API data to match parent dashboard Booking interface
        return result.data.map((booking: any) => {
          const startDate = new Date(booking.startTime);
          const endDate = new Date(booking.endTime);

          // Format date as YYYY-MM-DD using user's timezone to avoid UTC day shifts
          const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' });
          const date = dateFormatter.format(startDate); // en-CA gives YYYY-MM-DD format

          // Format times as HH:MM using user's timezone
          const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
          const startTime = timeFormatter.format(startDate);
          const endTime = timeFormatter.format(endDate);
          
          return {
            id: booking.id,
            caregiverId: booking.caregiverId,
            caregiverUserId: booking.caregiver?.id || booking.caregiverId, // User ID for chat
            caregiverName: `${booking.caregiver?.profile?.firstName || ''} ${booking.caregiver?.profile?.lastName || ''}`.trim() || 'Unknown Caregiver',
            caregiverPhoto: booking.caregiver?.profile?.avatar || undefined,
            caregiverRating: booking.caregiver?.averageRating || null, // Real rating from caregiver profile
            date: date,
            startTime: startTime,
            endTime: endTime,
            duration: booking.totalHours,
            totalAmount: booking.totalAmount / 100, // Convert from cents
            status: booking.status.toLowerCase() === 'pending' ? 'upcoming' :
                    booking.status.toLowerCase() === 'confirmed' ? 'upcoming' :
                    booking.status.toLowerCase() === 'in_progress' ? 'ongoing' :
                    booking.status.toLowerCase() === 'completed' ? 'completed' : 'cancelled',
            children: [], // TODO: Add children data
            address: booking.address,
            notes: booking.specialRequests || '',
            reviewGiven: booking.reviews && booking.reviews.length > 0 // Check if review exists
          };
        });
      }
      return [];
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }
  }, [user, userTimezone]);

  // Fetch fresh profile data directly from API to avoid stale session data
  const fetchFreshProfileData = useCallback(async () => {
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🏠 Fresh profile data from API:', {
          streetAddress: data.data?.profile?.streetAddress,
          city: data.data?.profile?.city,
          state: data.data?.profile?.state,
          zipCode: data.data?.profile?.zipCode,
          fullProfile: data.data?.profile
        });
        return data.data?.profile;
      } else {
        console.warn('❌ Profile API returned non-OK status:', response.status);
      }
    } catch (error) {
      console.warn('Failed to fetch fresh profile, using session data:', error);
    }
    return null;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch fresh profile data from API to ensure we have the latest address data
      // This fixes the issue where session data may be stale after signup
      const freshProfile = await fetchFreshProfileData();

      // Use fresh API data if available, otherwise fall back to session data
      const profileSource = freshProfile || user.profile;

      console.log('📋 Profile source for dashboard:', {
        usingFreshProfile: !!freshProfile,
        profileSource,
        streetAddress: profileSource?.streetAddress,
        city: profileSource?.city,
        state: profileSource?.state,
        sessionProfileCity: user.profile?.city,
        sessionProfileState: user.profile?.state
      });

      // Create profile from authenticated user data
      const userProfile: ParentProfile = {
        id: user.id,
        firstName: profileSource?.firstName || 'Parent',
        lastName: profileSource?.lastName || 'User',
        email: user.email,
        phone: profileSource?.phone || 'Not provided',
        address: {
          street: profileSource?.streetAddress || '',
          apartment: profileSource?.apartment || '',
          city: profileSource?.city || '',
          province: profileSource?.state || '',
          postalCode: profileSource?.zipCode || '',
          latitude: profileSource?.latitude || undefined,
          longitude: profileSource?.longitude || undefined,
        },
        emergencyContact: {
          name: profileSource?.emergencyName || 'Not provided',
          phone: profileSource?.emergencyPhone || 'Not provided',
          relationship: profileSource?.emergencyRelation || 'Not provided'
        },
        profilePhoto: profileSource?.avatar || undefined,
        memberSince: (() => {
          try {
            return user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          } catch (error) {
            console.warn('Invalid date format for user.createdAt:', user.createdAt);
            return new Date().toISOString().split('T')[0];
          }
        })(),
        totalBookings: 0, // Will be updated after fetching bookings
        children: [] // Will be updated after fetching children
      };

      // Fetch real data
      const [bookingsData, childrenData] = await Promise.all([
        fetchBookings(),
        fetchChildren()
      ]);

      // Update profile with actual data
      userProfile.totalBookings = bookingsData.length;
      userProfile.children = childrenData;

      // Add some initial sample notifications if this is a new user (moved to separate useEffect)

      setProfile(userProfile);
      // Set bookings from API
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, fetchFreshProfileData, fetchBookings, fetchChildren]);

  const updateProfile = useCallback(async (updatedProfile: ParentProfile) => {
    try {
      let addressResult = null;

      // Update address and phone via API
      if (updatedProfile.address || updatedProfile.phone) {
        const response = await fetch('/api/profile/update-address', {
          method: 'PATCH',
          headers: addCSRFHeader({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            streetAddress: updatedProfile.address?.street,
            apartment: updatedProfile.address?.apartment,
            city: updatedProfile.address?.city,
            state: updatedProfile.address?.province,
            zipCode: updatedProfile.address?.postalCode,
            country: updatedProfile.address?.country || 'Canada',
            phone: updatedProfile.phone
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update address');
        }

        addressResult = await response.json();
        console.log('✅ Address updated successfully:', addressResult);
      }

      // Update local state with data from API response (server-confirmed values)
      // This ensures we use the data that was actually saved to the database
      const updatedProfileWithServerData = {
        ...updatedProfile,
        address: {
          street: addressResult?.data?.profile?.streetAddress || updatedProfile.address?.street || '',
          apartment: addressResult?.data?.profile?.apartment || updatedProfile.address?.apartment || '',
          city: addressResult?.data?.profile?.city || updatedProfile.address?.city || '',
          province: addressResult?.data?.profile?.state || updatedProfile.address?.province || '',
          postalCode: addressResult?.data?.profile?.zipCode || updatedProfile.address?.postalCode || '',
          country: addressResult?.data?.profile?.country || updatedProfile.address?.country || 'Canada',
          latitude: addressResult?.data?.profile?.latitude || updatedProfile.address?.latitude,
          longitude: addressResult?.data?.profile?.longitude || updatedProfile.address?.longitude
        }
      };

      console.log('📍 Setting profile with server-confirmed data:', updatedProfileWithServerData.address);
      setProfile(updatedProfileWithServerData);
      setIsEditingProfile(false);

      // DO NOT call refreshUser() here - it triggers fetchDashboardData() via useEffect
      // which rebuilds profile from stale session data, overwriting our correct API response data.
      // This is the same pattern used in caregiver-dashboard (see line 836 in that file).
      // The session will be updated on next page load.
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  }, []);

  const addChild = useCallback(async (childData: Child) => {
    try {
      // Send to API to save in database
      const response = await fetch('/api/children', {
        method: 'POST',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          firstName: childData.firstName,
          lastName: childData.lastName,
          dateOfBirth: childData.dateOfBirth,
          gender: childData.gender,
          allergies: childData.allergies,
          medications: childData.medications,
          medicalConditions: childData.medicalConditions,
          emergencyMedicalInfo: childData.emergencyMedicalInfo,
          bloodType: childData.bloodType,
          emergencyContacts: childData.emergencyContacts,
          dietaryRestrictions: childData.dietaryRestrictions,
          specialInstructions: childData.specialInstructions,
          pickupInstructions: childData.pickupInstructions,
          photoUrl: childData.photoUrl
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create child profile');
      }

      const result = await response.json();

      if (result.success) {
        // If there's a pending photo, upload it now
        const pendingPhoto = (window as any).pendingChildPhoto;
        if (pendingPhoto && result.data?.id) {
          try {
            const photoFormData = new FormData();
            photoFormData.append('photo', pendingPhoto);
            photoFormData.append('childId', result.data.id);

            const photoResponse = await fetch('/api/children/upload-photo', {
              method: 'POST',
              headers: addCSRFHeader(),
              body: photoFormData,
            });

            if (photoResponse.ok) {
              console.log('Child photo uploaded successfully');
            }

            // Clear the pending photo
            delete (window as any).pendingChildPhoto;
          } catch (photoError) {
            console.error('Error uploading child photo:', photoError);
            // Don't fail the entire operation if photo upload fails
          }
        }

        // Refresh children data from API
        const childrenData = await fetchChildren();

        if (profile) {
          const updatedProfile = {
            ...profile,
            children: childrenData
          };
          setProfile(updatedProfile);
        }

        setShowChildProfile(false);
        setEditingChild(undefined);
      } else {
        throw new Error(result.error || 'Failed to create child profile');
      }
    } catch (error) {
      console.error('Error adding child:', error);
      alert('Failed to save child profile. Please try again.');
    }
  }, [profile, fetchChildren]);

  const updateChild = useCallback(async (childData: Child) => {
    try {
      if (!editingChild?.id) {
        alert('No child selected for editing');
        return;
      }

      const response = await fetch(`/api/children/${editingChild.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify(childData),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh children data from API
        const childrenData = await fetchChildren();
        
        if (profile) {
          const updatedProfile = {
            ...profile,
            children: childrenData
          };
          setProfile(updatedProfile);
        }

        setShowChildProfile(false);
        setEditingChild(undefined);
        alert('Child profile updated successfully!');
      } else {
        throw new Error(result.error || 'Failed to update child profile');
      }
    } catch (error) {
      console.error('Error updating child:', error);
      alert('Failed to update child profile. Please try again.');
    }
  }, [editingChild, profile, fetchChildren]);

  const handleSaveChild = useCallback((childData: Child) => {
    if (editingChild) {
      updateChild(childData);
    } else {
      addChild(childData);
    }
  }, [editingChild, updateChild, addChild]);

  const handleEditChild = useCallback((child: Child) => {
    setEditingChild(child);
    setShowChildProfile(true);
  }, []);

  const handleAddNewChild = useCallback(() => {
    setEditingChild(undefined);
    setShowChildProfile(true);
  }, []);

  const handleCancelChildProfile = useCallback(() => {
    setShowChildProfile(false);
    setEditingChild(undefined);
  }, []);

  // All hooks MUST be above early returns to avoid React error #310
  const upcomingBookings = useMemo(() => bookings.filter(b => b.status === 'upcoming').length, [bookings]);
  const unreadNotificationsList = useMemo(() => notifications.filter(n => !n.read), [notifications]);

  const handleLeaveReview = useCallback((booking: Booking) => {
    setReviewBooking(booking);
    setShowReviewForm(true);
  }, []);

  const handleSubmitReview = useCallback(async (reviewData: ReviewFormData) => {
    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          bookingId: reviewData.bookingId,
          caregiverId: reviewData.revieweeId,
          parentId: user?.id,
          rating: reviewData.rating,
          comment: reviewData.comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setBookings(prev => prev.map(b =>
        b.id === reviewData.bookingId ? { ...b, reviewGiven: true } : b
      ));

      setShowReviewForm(false);
      setReviewBooking(null);

      addSystemNotification('Review Submitted', 'Your review has been submitted successfully and is pending approval.');

    } catch (error) {
      console.error('Error submitting review:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  }, [user?.id, addSystemNotification]);

  const handleCloseReviewForm = useCallback(() => {
    setShowReviewForm(false);
    setReviewBooking(null);
  }, []);

  const handleTabChange = useCallback((tab: 'overview' | 'profile' | 'bookings' | 'messages' | 'children' | 'notifications' | 'saved' | 'support') => {
    setActiveTab(tab);

    if (tab === 'messages') {
      const unreadMessageNotifications = notifications.filter(n =>
        !n.read && n.type === 'message'
      );

      unreadMessageNotifications.forEach(notification => {
        markNotificationAsRead(notification.id);
      });

      refreshMessageCount();
    }
  }, [notifications, markNotificationAsRead, refreshMessageCount]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 dark:border-green-400"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Profile not found</h2>
          <p className="text-gray-600 dark:text-gray-300">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const unreadNotifications = realUnreadCount;
  const unreadMessageCount = realUnreadMessageCount;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Booking Chat Modal - moved to top for debugging */}
      {selectedChatBooking && user && showChatModal && (
        <BookingChatModal
          isOpen={true}
          onClose={() => {
            setShowChatModal(false);
            setSelectedChatBooking(null);
          }}
          bookingId={selectedChatBooking.id}
          otherPartyName={selectedChatBooking.caregiverName}
          otherPartyAvatar={selectedChatBooking.caregiverPhoto}
          otherPartyId={selectedChatBooking.caregiverUserId}
          currentUserId={user.id}
          currentUserName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.name || 'Parent'}
        />
      )}
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center">
                <div className="relative h-15 w-24">
                  <Image
                    src="/logo.png"
                    fill
                    alt="Instacares Logo"
                    className="object-contain"
                  />
                </div>
              </Link>
              <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Parent Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative notification-dropdown-container">
                <Bell
                  className="h-6 w-6 text-gray-600 dark:text-gray-300 cursor-pointer hover:text-green-600 dark:hover:text-green-400"
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Notifications
                          {unreadNotifications > 0 && (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                              ({unreadNotifications} new)
                            </span>
                          )}
                        </h3>
                      </div>
                      {notifications.length > 0 && (
                        <div className="flex items-center space-x-2">
                          {unreadNotifications > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAllAsRead();
                              }}
                              className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            >
                              Mark all read
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
                                await clearAll();
                                setShowNotificationDropdown(false);
                              }
                            }}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Clear all
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 10).map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => {
                              if (!notification.read) {
                                markNotificationAsRead(notification.id);
                              }
                              setShowNotificationDropdown(false);
                              if (notification.type === 'booking') {
                                setActiveTab('bookings');
                              } else if (notification.type === 'message') {
                                setActiveTab('messages');
                              }
                            }}
                            className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                              !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-2">
                              <div className="flex-shrink-0 mt-1">
                                {notification.type === 'booking' ? (
                                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                ) : notification.type === 'message' ? (
                                  <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : notification.type === 'payment' ? (
                                  <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0">
                                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">No notifications</p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 10 && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
                        <button
                          onClick={() => {
                            setShowNotificationDropdown(false);
                            setActiveTab('notifications');
                          }}
                          className="text-sm text-green-600 dark:text-green-400 hover:underline"
                        >
                          View all notifications
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {profile.profilePhoto ? (
                    <Image
                      src={profile.profilePhoto}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                        {profile.firstName[0]}{profile.lastName[0]}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {profile.firstName} {profile.lastName}
                  </span>
                </div>
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NotificationInitializer />
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-1/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <nav className="space-y-2">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'overview'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <User className="h-5 w-5 mr-3" />
                  Overview
                </button>
                <button
                  onClick={() => handleTabChange('profile')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'profile'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Profile Settings
                </button>
                <button
                  onClick={() => handleTabChange('bookings')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'bookings'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  Bookings
                  {upcomingBookings > 0 && (
                    <span className="ml-auto bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 text-xs rounded-full px-2 py-1">
                      {upcomingBookings}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('messages')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'messages'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageCircle className="h-5 w-5 mr-3" />
                  Messages
                  {unreadMessageCount > 0 && (
                    <span className="ml-auto bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs rounded-full px-2 py-1">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('children')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'children'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Baby className="h-5 w-5 mr-3" />
                  Children
                  <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full px-2 py-1">
                    {profile.children.length}
                  </span>
                </button>
                <button
                  onClick={() => handleTabChange('notifications')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'notifications'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Bell className="h-5 w-5 mr-3" />
                  Notifications
                  {unreadNotifications > 0 && (
                    <span className="ml-auto bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs rounded-full px-2 py-1">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('saved')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'saved'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Heart className="h-5 w-5 mr-3" />
                  Saved Providers
                </button>
                <button
                  onClick={() => handleTabChange('support')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'support'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <HelpCircle className="h-5 w-5 mr-3" />
                  Support
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Extension payment banner -- shows above all tabs when there are pending extension payments */}
            <ExtensionPaymentBanner />

            {activeTab === 'overview' && (
              <OverviewTab
                profile={profile}
                bookings={bookings}
                notifications={unreadNotificationsList}
                userTimezone={userTimezone}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab 
                profile={profile} 
                isEditing={isEditingProfile}
                onEdit={() => setIsEditingProfile(true)}
                onSave={updateProfile}
                onCancel={() => setIsEditingProfile(false)}
              />
            )}
            {activeTab === 'bookings' && (
              <BookingsTab
                bookings={bookings}
                handleTabChange={handleTabChange}
                handleLeaveReview={handleLeaveReview}
                onMessageCaregiver={(booking) => {
                  setSelectedChatBooking(booking);
                  setShowChatModal(true);
                  clearCountForBooking(booking.id);
                }}
                getCountForBooking={getCountForBooking}
                clearCountForBooking={clearCountForBooking}
                userTimezone={userTimezone}
              />
            )}
            {activeTab === 'messages' && user && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow min-h-[600px] h-[calc(100vh-12rem)]">
                <CSRFTokenProvider>
                  <OrganizedMessagesContainer
                    userId={user.id}
                    userType="parent"
                    onMessageRead={(count) => decrementMessageCount(count)}
                    onRefreshCount={refreshMessageCount}
                    userAvatar={user.profile?.avatar}
                    userName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.name || 'Parent'}
                  />
                </CSRFTokenProvider>
              </div>
            )}
            {activeTab === 'children' && (
              <ChildrenTab 
                childrenData={profile.children}
                onAddChild={handleAddNewChild}
                onEditChild={handleEditChild}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab
                notifications={notifications}
                onMarkAsRead={markNotificationAsRead}
                onMarkAllAsRead={markAllAsRead}
                addMessageNotification={addMessageNotification}
                addBookingNotification={addBookingNotification}
                addSystemNotification={addSystemNotification}
              />
            )}
            {activeTab === 'saved' && user && (
              <SavedProvidersTab userId={user.id} />
            )}
            {activeTab === 'support' && user && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <UserSupportTickets userType="PARENT" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Review Form Modal */}
      {showReviewForm && reviewBooking && (
        <ReviewForm
          booking={reviewBooking}
          onSubmit={handleSubmitReview}
          onClose={handleCloseReviewForm}
          isLoading={isSubmittingReview}
        />
      )}


      {/* Child Profile Modal */}
      {showChildProfile && (
        <ChildProfile
          child={editingChild}
          onSave={handleSaveChild}
          onCancel={handleCancelChildProfile}
          isOpen={showChildProfile}
        />
      )}

      {/* OAuth Profile Completion Modal - for new OAuth signups */}
      {showOAuthCompletionModal && user && (
        <SignupModal
          isOpen={showOAuthCompletionModal}
          onClose={() => setShowOAuthCompletionModal(false)}
          mode="oauthCompletion"
          initialUserType="parent"
          oauthUserData={{
            email: user.email || '',
            firstName: user.profile?.firstName || user.name?.split(' ')[0] || '',
            lastName: user.profile?.lastName || user.name?.split(' ').slice(1).join(' ') || '',
            image: user.profile?.avatar || undefined
          }}
          onOAuthComplete={async () => {
            // Mark profile as completed in this session to prevent modal from reopening
            setProfileCompletedInSession(true);
            setShowOAuthCompletionModal(false);
            // Refresh user data to update needsProfileCompletion status
            await refreshUser();
          }}
        />
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  profile: ParentProfile;
  bookings: Booking[];
  notifications: any[];
  userTimezone: string;
}> = ({ profile, bookings, notifications, userTimezone }) => {
  const upcomingBookings = bookings?.filter(b => b.status === 'upcoming') || [];
  const totalSpent = bookings
    ?.filter(b => b.status === 'completed')
    ?.reduce((sum, b) => sum + (b.totalAmount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome back, {profile.firstName}!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Manage your bookings, profile, and children all in one place.
        </p>
        <a
          href="/search"
          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-medium rounded-md transition"
        >
          <Plus className="h-4 w-4 mr-2" />
          Find Childcare
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Upcoming Bookings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{upcomingBookings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.totalBookings}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Baby className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Children</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.children.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <CreditCard className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCAD(Math.round(totalSpent * 100))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bookings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Bookings</h3>
          {upcomingBookings.length > 0 ? (
            <div className="space-y-4">
              {upcomingBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  {booking.caregiverPhoto ? (
                    <Image
                      src={booking.caregiverPhoto}
                      alt={booking.caregiverName}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-400 dark:text-gray-300" />
                    </div>
                  )}
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {booking.caregiverName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(booking.date + 'T12:00:00').toLocaleDateString('en-US', { timeZone: userTimezone })} at {booking.startTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCAD(Math.round(booking.totalAmount * 100))}
                    </p>
                    {booking.caregiverRating !== null && (
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                          {booking.caregiverRating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming bookings</p>
          )}
        </div>

        {/* Recent Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Notifications</h3>
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="flex items-start p-3 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex-shrink-0">
                    {notification.type === 'booking' && (
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                    {notification.type === 'caregiver' && (
                      <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                    {notification.type === 'payment' && (
                      <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    )}
                    {notification.type === 'system' && (
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(notification.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent notifications</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Profile Tab Component
const ProfileTab: React.FC<{
  profile: ParentProfile;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (profile: ParentProfile) => void;
  onCancel: () => void;
}> = ({ profile, isEditing, onEdit, onSave, onCancel }) => {
  const [formData, setFormData] = useState<ParentProfile>(profile);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { refreshUser } = useAuth();

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleSave = () => {
    onSave(formData);
  };

  const handleCancel = () => {
    setFormData(profile);
    onCancel();
  };
  
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, or WebP)');
      return;
    }
    
    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }
    
    setUploadingAvatar(true);
    
    try {
      const avatarFormData = new FormData();
      avatarFormData.append('avatar', file);
      
      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: avatarFormData,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, profilePhoto: data.data?.avatarUrl }));
        await refreshUser();
        // Force a page refresh to update the header immediately
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-medium rounded-lg"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm font-medium rounded-lg"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Photo Section */}
          <div className="lg:col-span-1">
            <div className="text-center">
              <div className="relative inline-block">
                {formData.profilePhoto ? (
                  <Image
                    src={formData.profilePhoto}
                    alt="Profile"
                    width={128}
                    height={128}
                    className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="h-32 w-32 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-700 shadow-lg">
                    <span className="text-green-600 dark:text-green-300 font-bold text-3xl">
                      {formData.firstName[0]}{formData.lastName[0]}
                    </span>
                  </div>
                )}
                {isEditing && (
                  <>
                    <input
                      type="file"
                      id="avatar-upload"
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 h-10 w-10 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center shadow-lg cursor-pointer"
                    >
                      {uploadingAvatar ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Edit2 className="h-5 w-5" />
                      )}
                    </label>
                  </>
                )}
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formData.firstName} {formData.lastName}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">{formData.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Member since {new Date(formData.memberSince).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white py-2">{formData.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white py-2">{formData.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <div className="flex items-center py-2">
                        <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                        <span className="text-gray-900 dark:text-white">{formData.email}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <div className="flex items-center py-2">
                        <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                        <span className="text-gray-900 dark:text-white">{formData.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Address Information</h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      {/* Address Autocomplete */}
                      <AddressAutocomplete
                        defaultValue={formData.address.street ? 
                          [
                            formData.address.street,
                            formData.address.city,
                            formData.address.province,
                            formData.address.postalCode
                          ].filter(Boolean).filter(val => val !== 'Not provided').join(', ') : 
                          ''
                        }
                        label="Start typing your address"
                        placeholder="e.g., 123 Main St, Toronto"
                        onAddressSelect={(address) => {
                          // Update all address fields at once
                          setFormData({
                            ...formData,
                            address: {
                              street: address.streetAddress,
                              apartment: address.apartment || '',
                              city: address.city,
                              province: address.state,
                              postalCode: address.zipCode,
                              latitude: address.latitude,
                              longitude: address.longitude
                            }
                          });
                          
                          // Log for debugging
                          console.log('📍 Address selected:', address);
                          if (address.latitude && address.longitude) {
                            console.log(`🎯 Coordinates: ${address.latitude}, ${address.longitude}`);
                          }
                        }}
                        required
                      />
                      
                      {/* Apartment/Unit Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Apartment/Unit Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={formData.address.apartment}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: { ...formData.address, apartment: e.target.value }
                          })}
                          placeholder="e.g., Apt 1A, Unit 205"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Show selected address preview */}
                      {(formData.address.street || formData.address.city || formData.address.province || formData.address.postalCode) && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Selected Address:</div>
                          <div className="text-sm text-gray-800 dark:text-gray-200">
                            {formData.address.street && (
                              <div>
                                {formData.address.street}
                                {formData.address.apartment && `, ${formData.address.apartment}`}
                              </div>
                            )}
                            <div className="flex gap-2">
                              {formData.address.city && <span>{formData.address.city}</span>}
                              {formData.address.province && <span>{formData.address.province}</span>}
                              {formData.address.postalCode && <span>{formData.address.postalCode}</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-900 dark:text-white">
                            {formData.address.street || 'No street address provided'}
                            {formData.address.apartment && `, ${formData.address.apartment}`}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-4 mr-2"></span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {formData.address.city && formData.address.province 
                              ? `${formData.address.city}, ${formData.address.province} ${formData.address.postalCode}` 
                              : 'No city/province provided'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.emergencyContact.name}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white py-2">{formData.emergencyContact.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.emergencyContact.phone}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white py-2">{formData.emergencyContact.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Relationship
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.emergencyContact.relationship}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          emergencyContact: { ...formData.emergencyContact, relationship: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white py-2">{formData.emergencyContact.relationship}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{formData.totalBookings}</div>
            <p className="text-gray-600 dark:text-gray-300">Total Bookings</p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{formData.children.length}</div>
            <p className="text-gray-600 dark:text-gray-300">Children</p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {Math.floor((Date.now() - new Date(formData.memberSince).getTime()) / (1000 * 60 * 60 * 24 * 30))}
            </div>
            <p className="text-gray-600 dark:text-gray-300">Months as Member</p>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Privacy & Security</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">Add an extra layer of security to your account</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Change Password</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">Update your account password</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
              Update
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Download Account Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">Export your account information and data</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg">
              Download
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-red-900 dark:text-red-400">Delete Account</h4>
              <p className="text-sm text-red-600 dark:text-red-400">Permanently delete your account and all data</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Bookings Tab Component
const BookingsTab: React.FC<{
  bookings: Booking[];
  handleTabChange: (tab: 'overview' | 'profile' | 'bookings' | 'messages' | 'notifications' | 'children') => void;
  handleLeaveReview: (booking: Booking) => void;
  onMessageCaregiver: (booking: Booking) => void;
  getCountForBooking: (bookingId: string) => number;
  clearCountForBooking: (bookingId: string) => void;
  userTimezone: string;
}> = ({ bookings, handleTabChange, handleLeaveReview, onMessageCaregiver, getCountForBooking, clearCountForBooking, userTimezone }) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  
  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300';
      case 'ongoing': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'completed': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming': return <Clock className="h-4 w-4" />;
      case 'ongoing': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h2>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg ${
                  filter === key
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-4">
                  <div className="flex space-x-3 sm:space-x-4 min-w-0">
                    {/* Caregiver Photo */}
                    <div className="flex-shrink-0">
                      {booking.caregiverPhoto ? (
                        <Image
                          src={booking.caregiverPhoto}
                          alt={booking.caregiverName}
                          width={64}
                          height={64}
                          className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 sm:h-16 sm:w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Booking Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                          {booking.caregiverName}
                        </h3>
                        {booking.caregiverRating !== null && (
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">
                              {booking.caregiverRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="ml-1 capitalize">{booking.status}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(booking.date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: userTimezone
                          })}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          {booking.startTime} - {booking.endTime} ({booking.duration}h)
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          {booking.address}
                        </div>
                        <div className="flex items-center">
                          <Baby className="h-4 w-4 mr-2" />
                          {booking.children.join(', ')}
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Notes:</strong> {booking.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booking Actions & Price */}
                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3 sm:border-0 sm:pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCAD(Math.round(booking.totalAmount * 100))}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      {booking.status === 'completed' && !booking.reviewGiven && (
                        <button
                          onClick={() => handleLeaveReview(booking)}
                          className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Leave Review
                        </button>
                      )}

                      {(booking.status === 'upcoming' || booking.status === 'ongoing') && (
                        <>
                          <button
                            onClick={() => onMessageCaregiver(booking)}
                            className="relative px-3 sm:px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-colors shadow-sm flex items-center justify-center whitespace-nowrap"
                          >
                            <MessageCircle className="h-4 w-4 mr-1.5" />
                            Message
                            {getCountForBooking(booking.id) > 0 && (
                              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                {getCountForBooking(booking.id) > 9 ? '9+' : getCountForBooking(booking.id)}
                              </span>
                            )}
                          </button>
                          {booking.status === 'upcoming' && (
                            <button className="px-3 sm:px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors whitespace-nowrap">
                              Cancel
                            </button>
                          )}
                        </>
                      )}

                      {booking.status === 'completed' && (
                        <button className="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors whitespace-nowrap">
                          Book Again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No bookings found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'all' 
                  ? "You haven't made any bookings yet."
                  : `You don't have any ${filter} bookings.`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChildrenTab: React.FC<{
  childrenData: Child[];
  onAddChild: () => void;
  onEditChild: (child: Child) => void;
}> = ({ childrenData, onAddChild, onEditChild }) => {

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const getAgeGroup = (age: number) => {
    if (age < 2) return { label: 'Infant', color: 'bg-pink-100 dark:bg-pink-900/20 text-pink-800 dark:text-pink-300' };
    if (age < 6) return { label: 'Toddler', color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300' };
    if (age < 13) return { label: 'Child', color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300' };
    return { label: 'Teen', color: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Severe': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700';
      case 'Moderate': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700';
      default: return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700';
    }
  };

  const getSafetyReminderColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white shadow-lg border-2 border-red-300 dark:border-red-400';
      case 'warning': return 'bg-gradient-to-r from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 text-white shadow-lg border-2 border-amber-300 dark:border-amber-400';
      case 'info': return 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white shadow-lg border-2 border-blue-300 dark:border-blue-400';
      default: return 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white shadow-lg border-2 border-green-300 dark:border-green-400';
    }
  };

  const getSafetyReminders = (child: Child) => {
    const reminders = [];
    
    // Critical allergy reminders
    const severeAllergies = child.allergies.filter(a => a.severity === 'Severe');
    if (severeAllergies.length > 0) {
      reminders.push({
        type: 'critical',
        icon: '🚨',
        title: 'SEVERE ALLERGIES ALERT',
        message: `${severeAllergies.map(a => a.name).join(', ')} - Keep EpiPen/emergency medication accessible at ALL TIMES`,
        priority: 1
      });
    }

    // Medication reminders
    if (child.medications.length > 0) {
      reminders.push({
        type: 'warning',
        icon: '💊',
        title: 'MEDICATION SCHEDULE',
        message: `${child.medications.length} prescribed medication(s) - Check times and dosages before meals/activities`,
        priority: 2
      });
    }

    // Emergency medical info
    if (child.emergencyMedicalInfo) {
      reminders.push({
        type: 'critical',
        icon: '🏥',
        title: 'EMERGENCY MEDICAL ALERT',
        message: child.emergencyMedicalInfo,
        priority: 1
      });
    }

    // Age-based safety reminders
    const age = calculateAge(child.dateOfBirth);
    if (age < 2) {
      reminders.push({
        type: 'info',
        icon: '👶',
        title: 'INFANT SAFETY',
        message: 'Always supervise during feeding, sleeping, and play. Check for choking hazards.',
        priority: 3
      });
    } else if (age < 6) {
      reminders.push({
        type: 'info',
        icon: '🧒',
        title: 'TODDLER SAFETY',
        message: 'Constant supervision near stairs, water, and small objects. Gate safety areas.',
        priority: 3
      });
    }

    // Emergency contacts reminder
    if (!child.emergencyContacts || child.emergencyContacts.length === 0) {
      reminders.push({
        type: 'warning',
        icon: '📞',
        title: 'MISSING EMERGENCY CONTACTS',
        message: 'Add emergency contacts immediately - Required for child safety',
        priority: 2
      });
    }

    return reminders.sort((a, b) => a.priority - b.priority);
  };

  const totalChildren = childrenData?.length || 0;
  const totalAllergies = childrenData?.reduce((sum, child) => sum + (child.allergies?.length || 0), 0) || 0;
  const severeAllergies = childrenData?.reduce((sum, child) => sum + (child.allergies?.filter(a => a.severity === 'Severe')?.length || 0), 0) || 0;
  const totalMedications = childrenData?.reduce((sum, child) => sum + (child.medications?.length || 0), 0) || 0;
  const childrenWithEmergencyInfo = childrenData?.filter(child => child.emergencyMedicalInfo)?.length || 0;

  return (
    <div className="space-y-6">
      {/* Safety Overview Dashboard */}
      {childrenData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-4 rounded-lg shadow-lg dark:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Total Children</p>
                <p className="text-2xl font-bold">{totalChildren}</p>
              </div>
              <div className="text-3xl opacity-80">👨‍👩‍👧‍👦</div>
            </div>
          </div>

          <div className={`p-4 rounded-lg shadow-lg dark:shadow-xl ${severeAllergies > 0 ? 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white animate-pulse' : 'bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Allergies</p>
                <p className="text-2xl font-bold">{totalAllergies}</p>
                {severeAllergies > 0 && (
                  <p className="text-xs font-bold animate-bounce">⚠️ {severeAllergies} SEVERE</p>
                )}
              </div>
              <div className="text-3xl opacity-80">⚠️</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white p-4 rounded-lg shadow-lg dark:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Medications</p>
                <p className="text-2xl font-bold">{totalMedications}</p>
              </div>
              <div className="text-3xl opacity-80">💊</div>
            </div>
          </div>

          <div className={`p-4 rounded-lg shadow-lg dark:shadow-xl ${childrenWithEmergencyInfo > 0 ? 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white' : 'bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 text-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Emergency Alerts</p>
                <p className="text-2xl font-bold">{childrenWithEmergencyInfo}</p>
              </div>
              <div className="text-3xl opacity-80">🚨</div>
            </div>
          </div>
        </div>
      )}

      {/* Critical Safety Alert Banner */}
      {(severeAllergies > 0 || childrenWithEmergencyInfo > 0) && (
        <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white p-4 sm:p-6 rounded-lg shadow-xl dark:shadow-2xl border-4 border-red-300 dark:border-red-400 animate-pulse">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="text-3xl sm:text-4xl animate-bounce flex-shrink-0">🚨</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-bold mb-2">CRITICAL SAFETY ALERT</h3>
              <p className="font-medium text-sm sm:text-base">
                {severeAllergies > 0 && `${severeAllergies} child(ren) have SEVERE allergies requiring immediate attention. `}
                {childrenWithEmergencyInfo > 0 && `${childrenWithEmergencyInfo} child(ren) have emergency medical conditions. `}
                Ensure all caregivers are fully briefed before any childcare session.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Children</h2>
          <button
            onClick={onAddChild}
            className="inline-flex items-center justify-center px-4 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Child
          </button>
        </div>

        {/* Children List */}
        <div className="space-y-4">
          {childrenData.length > 0 ? (
            childrenData.map((child) => {
              const age = calculateAge(child.dateOfBirth);
              const ageGroup = getAgeGroup(age);
              const safetyReminders = getSafetyReminders(child);
              
              return (
              <div key={child.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 hover:shadow-md dark:hover:shadow-lg transition-all">
                <div className="flex flex-col gap-4">
                  <div className="flex space-x-3 sm:space-x-4">
                    <div className="flex-shrink-0">
                      {child.photoUrl ? (
                        <Image
                          src={child.photoUrl}
                          alt={`${child.firstName} ${child.lastName}`}
                          width={64}
                          height={64}
                          unoptimized
                          className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-purple-200 dark:ring-purple-700"
                        />
                      ) : (
                        <div className="h-12 w-12 sm:h-16 sm:w-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center ring-2 ring-purple-200 dark:ring-purple-700">
                          <Baby className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                          {child.firstName} {child.lastName}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ageGroup.color}`}>
                          {age}y • {ageGroup.label}
                        </span>
                        {child.gender && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {child.gender}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 text-sm text-gray-600 dark:text-gray-300 mb-3">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                          Born: {new Date(child.dateOfBirth).toLocaleDateString()}
                        </div>
                        {child.bloodType && (
                          <div className="flex items-center">
                            <span className="inline-flex items-center mr-2">❤️</span>
                            <span className="mr-2">Blood Type:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                              {child.bloodType}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Allergies */}
                      {child.allergies.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                            <span className="mr-2">⚠️</span>
                            Allergies:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {child.allergies.slice(0, 3).map((allergy, index) => (
                              <span
                                key={allergy.id || index}
                                className={`inline-flex items-center px-3 py-1 text-xs rounded-full font-medium ${getSeverityColor(allergy.severity)}`}
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {allergy.name} 
                                <span className="ml-1 px-1 py-0.5 text-xs rounded bg-white/20 dark:bg-black/20">
                                  {allergy.severity}
                                </span>
                              </span>
                            ))}
                            {child.allergies.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center px-2 py-1">
                                +{child.allergies.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {child.medications.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                            <span className="mr-2">💊</span>
                            Medications:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {child.medications.slice(0, 2).map((medication, index) => (
                              <span
                                key={medication.id || index}
                                className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium"
                              >
                                <span className="mr-1">💊</span>
                                {medication.name} 
                                <span className="ml-1 px-1 py-0.5 text-xs rounded bg-white/20 dark:bg-black/20">
                                  {medication.dosage}
                                </span>
                              </span>
                            ))}
                            {child.medications.length > 2 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center px-2 py-1">
                                +{child.medications.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Medical Conditions */}
                      {child.medicalConditions.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                            <span className="mr-2">🏥</span>
                            Medical Conditions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {child.medicalConditions.slice(0, 2).map((condition, index) => (
                              <span
                                key={condition.id || index}
                                className="inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {condition.condition}
                              </span>
                            ))}
                            {child.medicalConditions.length > 2 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center px-2 py-1">
                                +{child.medicalConditions.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Emergency Medical Info */}
                      {child.emergencyMedicalInfo && (
                        <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-800 dark:text-red-300">
                            <strong className="flex items-center mb-2">
                              <span className="mr-2">🚨</span>
                              Emergency Medical Information:
                            </strong>
                            {child.emergencyMedicalInfo}
                          </p>
                        </div>
                      )}

                      {/* Special Instructions */}
                      {child.specialInstructions && (
                        <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            <strong className="flex items-center mb-2">
                              <span className="mr-2">📝</span>
                              Special Instructions:
                            </strong>
                            {child.specialInstructions}
                          </p>
                        </div>
                      )}

                      {/* Safety Reminders - Comprehensive & Dark Mode Compatible */}
                      {safetyReminders.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                              <span className="mr-2">🛡️</span>
                              SAFETY REMINDERS FOR CAREGIVERS
                            </h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                              {safetyReminders.length} alerts
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {safetyReminders.map((reminder, index) => (
                              <div
                                key={index}
                                className={`p-4 rounded-lg transition-all hover:scale-[1.02] ${getSafetyReminderColor(reminder.type)} ${reminder.type === 'critical' ? 'animate-pulse' : ''}`}
                              >
                                <div className="flex items-start space-x-3">
                                  <span className={`text-2xl flex-shrink-0 ${reminder.type === 'critical' ? 'animate-bounce' : ''}`}>
                                    {reminder.icon}
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <h5 className="font-bold text-sm uppercase tracking-wide">
                                        {reminder.title}
                                      </h5>
                                      <span className="text-xs bg-white/20 dark:bg-black/20 px-2 py-1 rounded-full">
                                        {reminder.type.toUpperCase()}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed opacity-95">
                                      {reminder.message}
                                    </p>
                                  </div>
                                </div>
                                {reminder.type === 'critical' && (
                                  <div className="mt-3 pt-3 border-t border-white/30 dark:border-white/20">
                                    <div className="flex items-center justify-center">
                                      <p className="text-xs font-bold uppercase tracking-wider bg-white/20 dark:bg-black/20 px-3 py-1 rounded-full">
                                        ⚠️ IMMEDIATE ATTENTION REQUIRED ⚠️
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Medical Information Quick Reference */}
                      <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 text-white rounded-lg shadow-lg dark:shadow-xl">
                        <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-3 flex items-center">
                          <span className="mr-2">🏥</span>
                          MEDICAL QUICK REFERENCE
                        </h4>
                        <div className="grid grid-cols-2 gap-2 sm:gap-4 text-sm">
                          <div>
                            <p className="font-semibold opacity-90">Age Group:</p>
                            <p className="font-medium">{ageGroup.label} ({age} years old)</p>
                          </div>
                          {child.bloodType && (
                            <div>
                              <p className="font-semibold opacity-90">Blood Type:</p>
                              <p className="font-bold text-lg">{child.bloodType}</p>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold opacity-90">Allergies:</p>
                            <p className="font-medium">{child.allergies.length > 0 ? `${child.allergies.length} known` : 'None reported'}</p>
                          </div>
                          <div>
                            <p className="font-semibold opacity-90">Medications:</p>
                            <p className="font-medium">{child.medications.length > 0 ? `${child.medications.length} active` : 'None'}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/30">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold">
                              📞 Emergency Contacts: {child.emergencyContacts?.length || 0} available
                            </p>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className={`w-2 h-2 rounded-full ${child.emergencyContacts?.length > 0 ? 'bg-green-400' : 'bg-red-400'}`}></span>
                              <span className="font-medium">
                                {child.emergencyContacts?.length > 0 ? 'READY' : 'INCOMPLETE'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Safety Checklist */}
                      <div className="mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white mb-3 flex items-center">
                          <span className="mr-2">✅</span>
                          CAREGIVER SAFETY CHECKLIST
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className={`flex items-center space-x-2 ${child.allergies.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                            <span>{child.allergies.length > 0 ? '⚠️' : '✅'}</span>
                            <span>Allergy information reviewed</span>
                          </div>
                          <div className={`flex items-center space-x-2 ${child.medications.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                            <span>{child.medications.length > 0 ? '💊' : '✅'}</span>
                            <span>Medication schedule noted</span>
                          </div>
                          <div className={`flex items-center space-x-2 ${child.emergencyContacts?.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            <span>{child.emergencyContacts?.length > 0 ? '✅' : '❌'}</span>
                            <span>Emergency contacts accessible</span>
                          </div>
                          <div className={`flex items-center space-x-2 ${child.emergencyMedicalInfo ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            <span>{child.emergencyMedicalInfo ? '🚨' : '✅'}</span>
                            <span>Medical alerts acknowledged</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>👥 {child.emergencyContacts?.length || 0} contacts</span>
                      {child.allergies.length > 0 && (
                        <span>⚠️ {child.allergies.length} allergies</span>
                      )}
                      {child.medications.length > 0 && (
                        <span>💊 {child.medications.length} meds</span>
                      )}
                    </div>
                    <button
                      onClick={() => onEditChild(child)}
                      className="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Edit2 className="h-4 w-4 mr-1.5 inline" />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Baby className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No children added yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Add your children's detailed profiles with medical information, allergies, emergency contacts, and safety details to help caregivers provide the best possible care.
              </p>
              <button
                onClick={onAddChild}
                className="inline-flex items-center px-6 py-3 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Child Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Child Safety Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              Comprehensive Child Safety & Medical Information
            </h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>• <strong>Medical Details:</strong> Include allergies, medications, medical conditions, and emergency medical information</p>
              <p>• <strong>Emergency Contacts:</strong> Add trusted family members, doctors, and authorized pickup persons</p>
              <p>• <strong>Safety Instructions:</strong> Provide pickup instructions, dietary restrictions, and special care needs</p>
              <p>• <strong>Real-time Updates:</strong> Caregivers can access this information instantly for better care</p>
              <p>• <strong>Privacy Protected:</strong> All information is encrypted and only shared with your chosen caregivers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Safety Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">
              Safety Reminders
            </h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>• Keep all information current - update when medications or conditions change</p>
              <p>• Include severity levels for allergies and detailed treatment instructions</p>
              <p>• Add photos to help caregivers easily identify your children</p>
              <p>• Regularly review and verify emergency contact information</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotificationsTab: React.FC<{
  notifications: any[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  addMessageNotification: (senderName: string, message: string, roomId?: string) => any;
  addBookingNotification: (title: string, message: string, bookingId?: string, actionType?: 'request' | 'confirmation' | 'reminder') => any;
  addSystemNotification: (title: string, message: string) => any;
}> = ({ notifications, onMarkAsRead, onMarkAllAsRead, addMessageNotification, addBookingNotification, addSystemNotification }) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking': return <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'caregiver': return <User className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'payment': return <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case 'system': return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default: return <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const markAllAsReadHandler = async () => {
    onMarkAllAsRead();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                {unreadCount} unread
              </span>
            )}
          </h2>

          <div className="flex space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsReadHandler}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Mark all as read
              </button>
            )}

            {/* Filter Buttons */}
            <div className="flex space-x-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread' },
                { key: 'read', label: 'Read' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    filter === key
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  notification.read
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:shadow-md'
                }`}
                onClick={() => !notification.read && onMarkAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white font-semibold'}`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-1 ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {new Date(notification.timestamp).toLocaleString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                        
                        {notification.actionUrl && (
                          <button
                            className="px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle navigation to actionUrl
                              console.log('Navigate to:', notification.actionUrl);
                            }}
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No notifications</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'all'
                  ? "You're all caught up!"
                  : `No ${filter} notifications.`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      
      {/* Test Notification Buttons (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4">Test Notifications (Development)</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addMessageNotification('Test Caregiver', 'This is a test message notification from the system.', 'test-room-123')}
              className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-lg hover:bg-blue-200"
            >
              Add Test Message
            </button>
            <button
              onClick={() => addBookingNotification('Test Booking', 'Your test booking has been confirmed!', 'test-booking-123', 'confirmation')}
              className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded-lg hover:bg-green-200"
            >
              Add Test Booking
            </button>
            <button
              onClick={() => addSystemNotification('Test System Alert', 'This is a test system notification.')}
              className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded-lg hover:bg-purple-200"
            >
              Add Test System
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// Wrapper component that provides SocketProvider with user context
const ParentDashboardWithSocket: React.FC = () => {
  const { user } = useAuth();

  return (
    <SocketProvider userId={user?.id} userType="parent">
      <ParentDashboardContent />
    </SocketProvider>
  );
};

const ParentDashboard: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>}>
      <ParentDashboardWithSocket />
    </Suspense>
  );
};

export default ParentDashboard;