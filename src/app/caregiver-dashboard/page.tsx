"use client";
import dynamic from "next/dynamic";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { DateTime } from "luxon";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
const MapboxAddressAutocomplete = dynamic(() => import("@/components/MapboxAddressAutocomplete"), { ssr: false });
import {
  CalendarDaysIcon,
  PhotoIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  EyeIcon,
  UserGroupIcon,
  TagIcon,
  CreditCardIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellIcon,
  XMarkIcon,
  QuestionMarkCircleIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import Chat from "../../components/Chat";
import ChatWebSocket from "../../components/ChatWebSocket";
import OrganizedMessagesContainer from "../../components/OrganizedMessagesContainer";
import { SocketProvider } from "../../context/SocketContext";
import NotificationInitializer from "../../components/NotificationInitializer";
import { useNotificationStorage } from "../../hooks/useNotificationStorage";
import { useUnreadMessageCount } from "../../hooks/useUnreadMessageCount";
import { useBookingUnreadCounts } from "../../hooks/useBookingUnreadCounts";
import PhotoUpload from "../../components/PhotoUpload";
import CaregiverProfileImage from "../../components/CaregiverProfileImage";
import ThemeToggle from "../../components/ThemeToggle";
import SignupModal from "../../components/SignupModal";
// Dynamic imports for analytics components to reduce initial bundle size (388KB Recharts)
const EarningsChart = dynamic(() => import("../../components/analytics/EarningsChart"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>,
  ssr: false
});
const BookingAnalytics = dynamic(() => import("../../components/analytics/BookingAnalytics"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading analytics...</span></div>,
  ssr: false
});
const ClientRetention = dynamic(() => import("../../components/analytics/ClientRetention"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading retention data...</span></div>,
  ssr: false
});
const PerformanceMetrics = dynamic(() => import("../../components/analytics/PerformanceMetrics"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading metrics...</span></div>,
  ssr: false
});
const TaxReports = dynamic(() => import("../../components/analytics/TaxReports"), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading tax reports...</span></div>,
  ssr: false
});
import IntuitiveScheduleManager from "../../components/IntuitiveScheduleManager";
import SimpleScheduleBuilder from "../../components/SimpleScheduleBuilder";
import ProfileCompletionBanner from "../../components/ProfileCompletionBanner";
import { useCaregiverProfile } from "../../hooks/useCaregiverProfile";
import { addCSRFHeader } from '@/lib/csrf';
import StripeRedirectLoading from "../../components/StripeRedirectLoading";
import StripeOnboardingSuccess from "../../components/StripeOnboardingSuccess";

const StripeConnectOnboarding = dynamic(() => import("../../components/StripeConnectOnboarding"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-300">Loading payment setup...</span>
    </div>
  ),
});
import UserSupportTickets from "../../components/UserSupportTickets";
import BabysitterDashboard from "../../components/BabysitterDashboard";
// Dynamic import for BookingChatModal to reduce initial bundle size (socket.io-client)
const BookingChatModal = dynamic(() => import("../../components/BookingChatModal"), {
  loading: () => null,
  ssr: false
});
// Dynamic import for ChildDetailsModal
const ChildDetailsModal = dynamic(() => import("../../components/ChildDetailsModal"), {
  loading: () => null,
  ssr: false
});

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  spotsAvailable: number;
  recurring: boolean;
}

interface DaycarePhoto {
  id: string;
  url: string;
  caption: string;
  isProfile: boolean;
  sortOrder: number;
}

interface AgeGroup {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

interface Specialty {
  id: string;
  name: string;
  selected: boolean;
}

interface CaregiverService {
  id: string;
  type: string;
  name: string;
  description: string;
  selected: boolean;
}

interface Booking {
  id: string;
  parentId: string;
  parentName: string;
  parentAvatar?: string;
  startTime: string;
  endTime: string;
  childrenCount: number;
  specialRequests?: string;
  address: string;
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  requestedAt: string;
  confirmedAt?: string;
  unreadMessages?: number;
}

function CaregiverDashboardContent() {
  const { user, loading: authLoading, isAuthenticated, isCaregiver, logout, refreshUser } = useAuth();
  const { caregiverId, loading: caregiverLoading, error: caregiverError } = useCaregiverProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  // OAuth profile completion modal state
  const [showOAuthCompletionModal, setShowOAuthCompletionModal] = useState(false);
  const [profileCompletedInSession, setProfileCompletedInSession] = useState(false);

  // Redirect babysitter users to their own dashboard
  useEffect(() => {
    if (isAuthenticated && user?.isBabysitter) {
      router.push('/babysitter-dashboard');
    }
  }, [isAuthenticated, user?.isBabysitter, router]);

  // Show OAuth profile completion modal when caregiver needs to complete their profile
  useEffect(() => {
    // Check URL parameters for OAuth redirect (oauth=true&userType=caregiver)
    const isOAuthCallback = searchParams.get('oauth') === 'true';
    const urlUserType = searchParams.get('userType');

    console.log('Caregiver Dashboard OAuth check:', {
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
      window.history.replaceState({}, '', '/caregiver-dashboard');
    }

    // Show modal ONLY if:
    // 1. User is authenticated
    // 2. User ACTUALLY needs profile completion (not just because of OAuth params)
    // 3. User hasn't already completed profile in this session
    // 4. Modal isn't already showing
    // NOTE: OAuth params are only used to know this is a caregiver signup, but modal only shows if needsProfileCompletion is true
    // Don't show modal for babysitter users - they are being redirected to babysitter-dashboard
    const shouldShowModal = isAuthenticated &&
      user?.needsProfileCompletion === true &&
      !user?.isBabysitter &&
      !profileCompletedInSession &&
      !showOAuthCompletionModal;

    if (shouldShowModal) {
      console.log('Opening OAuth profile completion modal for caregiver');
      setShowOAuthCompletionModal(true);
    }
  }, [isAuthenticated, user?.needsProfileCompletion, user?.id, user?.email, profileCompletedInSession, showOAuthCompletionModal, searchParams]);

  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'bookings' | 'messages' | 'preferences' | 'photos' | 'payments' | 'analytics' | 'support' | 'notifications'>('profile');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  // Get user timezone for proper time display
  const { timezone: userTimezone } = useUserTimezone();
  // Use real notification storage for caregivers too
  const {
    notifications,
    unreadCount: realUnreadCount,
    markAsRead,
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

  // Calculate notification badge counts
  const unreadBookingCount = useMemo(() => notifications.filter(n =>
    !n.read && (n.type === 'booking' || n.type === 'caregiver')
  ).length, [notifications]);
  

  // Use real unread message count from chat rooms
  const unreadMessageCount = realUnreadMessageCount;

  // Helper function to check if a booking start time has passed (timezone-aware)
  const isBookingExpired = useCallback((startTime: string | Date): boolean => {
    const bookingStart = DateTime.fromJSDate(new Date(startTime), { zone: 'utc' }).setZone(userTimezone);
    const now = DateTime.now().setZone(userTimezone);
    return bookingStart < now;
  }, [userTimezone]);

  // Badge counts calculated

  // Mark message notifications as read when messages tab is viewed
  const handleTabChange = useCallback((tab: 'profile' | 'schedule' | 'bookings' | 'messages' | 'preferences' | 'photos' | 'payments' | 'analytics' | 'support' | 'notifications') => {
    setActiveTab(tab);

    if (tab === 'messages') {
      // Mark all unread message notifications as read
      const unreadMessageNotifications = notifications.filter(n =>
        !n.read && n.type === 'message'
      );

      unreadMessageNotifications.forEach(notification => {
        markAsRead(notification.id);
      });

      // Refresh real message count when opening messages tab
      refreshMessageCount();
    }
  }, [notifications, markAsRead, refreshMessageCount]);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(25);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profile?.avatar || null);
  
  // About Me editing state
  const [bio, setBio] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  
  // Address editing state
  const [addressData, setAddressData] = useState({
    streetAddress: user?.profile?.streetAddress || '',
    apartment: user?.profile?.apartment || '',
    city: user?.profile?.city || '',
    state: user?.profile?.province || user?.profile?.state || '',
    zipCode: user?.profile?.postalCode || user?.profile?.zipCode || '',
    country: user?.profile?.country || 'US'
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  
  // Stripe Connect state
  const [stripeAccountId, setStripeAccountId] = useState<string>('');
  const [stripeAccountStatus, setStripeAccountStatus] = useState<{
    canReceivePayments: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    requirements?: {
      currently_due: string[];
      eventually_due: string[];
      past_due?: string[];
    };
  }>({
    canReceivePayments: false,
    chargesEnabled: false,
    detailsSubmitted: false,
    payoutsEnabled: false,
    requirements: undefined,
  });
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [showInlineOnboarding, setShowInlineOnboarding] = useState(false);
  const [inlineAccountId, setInlineAccountId] = useState<string | null>(null);
  const [showRedirectLoading, setShowRedirectLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Update profile photo and address when user changes
  useEffect(() => {
    if (user?.profile?.avatar) {
      setProfilePhoto(user.profile.avatar);
    }
    if (user?.profile) {
      setAddressData({
        streetAddress: user.profile.streetAddress || '',
        apartment: user.profile.apartment || '',
        city: user.profile.city || '',
        state: user.profile.province || user.profile.state || '',
        zipCode: user.profile.postalCode || user.profile.zipCode || '',
        country: user.profile.country || 'US'
      });
    }
  }, [user]);

  // Fetch caregiver bio and experience
   
  const fetchCaregiverProfile = async () => {
    if (!caregiverId) return;

    try {
      const response = await fetch(`/api/caregivers/${caregiverId}`);
      if (!response.ok) throw new Error('Failed to fetch caregiver profile');

      const data = await response.json();
      const caregiver = data.data?.caregiver;
      if (caregiver) {
        setBio(caregiver.bio || '');
        setExperienceYears(caregiver.experienceYears || 0);
        if (caregiver.hourlyRate) {
          setHourlyRate(caregiver.hourlyRate);
        }

        // Load services if available
        if (caregiver.services && Array.isArray(caregiver.services)) {
          setServices(prev => prev.map(service => ({
            ...service,
            selected: caregiver.services.some((s: any) => s.type === service.type && s.isOffered)
          })));
        }

        // Load age groups if available
        if (caregiver.ageGroups && Array.isArray(caregiver.ageGroups)) {
          setAgeGroups(prev => prev.map(group => ({
            ...group,
            selected: caregiver.ageGroups.some((g: any) => g.id === group.id)
          })));
        }

        // Load specialties if available
        if (caregiver.specialties && Array.isArray(caregiver.specialties)) {
          setSpecialties(prev => prev.map(specialty => ({
            ...specialty,
            selected: caregiver.specialties.includes(specialty.name)
          })));
        }

        // Load Stripe account ID from database (overrides localStorage)
        if (caregiver.stripeAccountId) {
          updateStripeAccountId(caregiver.stripeAccountId);
          // Also fetch the latest status for this account
          checkStripeAccountStatus(caregiver.stripeAccountId);
        } else {
          // DB has no Stripe account — clear any stale localStorage value
          clearStripeData();
        }
      }
    } catch (error) {
      console.error('Error fetching caregiver profile:', error);
    }
  };

  // Fetch caregiver profile when caregiverId is available
  useEffect(() => {
    if (caregiverId) {
      fetchCaregiverProfile();
    }
  }, [caregiverId]);

  // Fetch caregiver bookings
  const fetchBookings = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingBookings(true);
      setBookingError(null);

      const response = await fetch(`/api/bookings?userId=${user.id}&userType=caregiver`);

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setBookings(result.data);
      } else {
        throw new Error(result.error || 'Failed to load bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookingError(error instanceof Error ? error.message : 'Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  }, [user?.id]);

  // Fetch caregiver photos
  const fetchPhotos = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingPhotos(true);

      const response = await fetch('/api/caregivers/photos');

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const result = await response.json();

      if (result.data?.photos) {
        setPhotos(result.data.photos);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  }, [user?.id]);

  // Update booking status
  const updateBookingStatus = useCallback(async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update booking status');
      }

      // Refresh bookings after update
      fetchBookings();
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status. Please try again.');
    }
  }, [fetchBookings]);

  // Handle booking extension request
   
  const handleExtendBooking = async () => {
    if (!selectedExtendBooking) return;

    setIsExtending(true);
    setExtensionError(null);

    try {
      const response = await fetch(`/api/bookings/${selectedExtendBooking.id}/extend`, {
        method: 'POST',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          extensionMinutes,
          reason: extensionReason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extend booking');
      }

      // Success - close modal and refresh
      setShowExtendModal(false);
      setSelectedExtendBooking(null);
      setExtensionMinutes(30);
      setExtensionReason('');
      fetchBookings();

      if (data.data?.extension?.status === 'PAID') {
        alert(`Booking extended by ${extensionMinutes} minutes. Parent has been charged $${(data.data.extension.extensionAmount / 100).toFixed(2)}.`);
      } else {
        alert('Extension requested. Waiting for payment confirmation.');
      }
    } catch (error) {
      console.error('Error extending booking:', error);
      setExtensionError(error instanceof Error ? error.message : 'Failed to extend booking');
    } finally {
      setIsExtending(false);
    }
  };

  // Redirect if not authenticated or not a caregiver
  // Add a small delay to allow session state to fully sync after page refresh
  useEffect(() => {
    if (!authLoading) {
      // Give a brief moment for user state to sync from session
      const timer = setTimeout(() => {
        // Check if this is an OAuth callback for caregiver signup
        // In this case, DON'T redirect - let the user complete their profile and become a caregiver
        const isOAuthCallback = searchParams.get('oauth') === 'true';
        const urlUserType = searchParams.get('userType');
        const isCaregiverOAuthSignup = isOAuthCallback && urlUserType === 'caregiver';

        // Also check localStorage for caregiver OAuth signup intent
        const storedUserType = typeof window !== 'undefined' ? localStorage.getItem('oauthSignupUserType') : null;
        const isCaregiverFromStorage = storedUserType === 'caregiver';

        // Skip redirect if user is in the middle of caregiver OAuth signup flow
        const isCompletingCaregiverSignup = isCaregiverOAuthSignup || isCaregiverFromStorage;

        if (isAuthenticated && !isCaregiver && !isCompletingCaregiverSignup) {
          // User is authenticated but not a caregiver AND not completing caregiver signup - redirect to home
          console.log('Caregiver Dashboard: Redirecting non-caregiver to home', { isCaregiver, isCompletingCaregiverSignup });
          router.push('/');
        } else if (!isAuthenticated && !user) {
          // User is not authenticated at all - redirect to login
          router.push('/login');
        } else if (isCompletingCaregiverSignup) {
          console.log('Caregiver Dashboard: Allowing non-caregiver to stay for OAuth profile completion', { isCaregiverOAuthSignup, isCaregiverFromStorage });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, isCaregiver, user, router, searchParams]);

  // Fetch data when authenticated (separate effect to avoid redirect loop)
  useEffect(() => {
    if (!authLoading && isAuthenticated && isCaregiver && user) {
      fetchBookings();
      fetchPhotos();
    }
  }, [authLoading, isAuthenticated, isCaregiver, user]);

  // Clean up old sample data - run once per user
  useEffect(() => {
    if (user) {
      const cleanupVersion = localStorage.getItem(`cleanup-v1-${user.id}`);
      
      if (!cleanupVersion) {
        // Remove old notification initialization flag
        localStorage.removeItem(`notifications-initialized-${user.id}`);
        
        // Clear all notifications for this user to remove sample notifications
        const storageKey = `notifications-${user.id}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const allNotifications = JSON.parse(stored);
            // Remove sample notifications (Sarah Johnson, booking requests)
            const cleanedNotifications = allNotifications.filter((n: any) => 
              !n.message?.includes('Sarah Johnson') && 
              !n.title?.includes('New Booking Request') &&
              !n.message?.includes('this weekend')
            );
            localStorage.setItem(storageKey, JSON.stringify(cleanedNotifications));
          } catch (e) {
            console.error('Error cleaning notifications:', e);
          }
        }
        
        // Mark cleanup as done
        localStorage.setItem(`cleanup-v1-${user.id}`, 'true');
        
        // Force reload to fetch fresh data
        window.location.reload();
      }
    }
  }, [user?.id]);

  // Add initial notifications for new caregiver users
  useEffect(() => {
    if (user && notifications.length === 0) {
      // Use a flag to prevent multiple executions
      const notificationInitialized = localStorage.getItem(`notifications-initialized-${user.id}`);
      
      if (!notificationInitialized) {
        // Add welcome notification for new caregivers
        addSystemNotification('Welcome to Instacares!', 'Thank you for joining as a caregiver. Complete your profile to start receiving booking requests.');
        
        // Mark as initialized
        localStorage.setItem(`notifications-initialized-${user.id}`, 'true');
      }
    }
  }, [user?.id, notifications.length]); // Only depend on user.id and notification count

  // Load Stripe data from localStorage on component mount
  useEffect(() => {
    try {
      const savedStripeAccountId = localStorage.getItem('stripeAccountId');
      const savedStripeStatus = localStorage.getItem('stripeAccountStatus');
      
      if (savedStripeAccountId) {
        setStripeAccountId(savedStripeAccountId);
      }
      
      if (savedStripeStatus) {
        const status = JSON.parse(savedStripeStatus);
        setStripeAccountStatus(status);
      }
    } catch (error) {
      console.error('Failed to load Stripe data from localStorage:', error);
    }
  }, []);

  // Save Stripe account ID to localStorage whenever it changes
  const updateStripeAccountId = useCallback((accountId: string) => {
    setStripeAccountId(accountId);
    try {
      if (accountId) {
        localStorage.setItem('stripeAccountId', accountId);
      } else {
        localStorage.removeItem('stripeAccountId');
      }
    } catch (error) {
      console.error('Failed to save Stripe account ID to localStorage:', error);
    }
  }, []);

  // Save Stripe status to localStorage whenever it changes
  const updateStripeAccountStatus = useCallback((status: typeof stripeAccountStatus) => {
    setStripeAccountStatus(status);
    try {
      localStorage.setItem('stripeAccountStatus', JSON.stringify(status));
    } catch (error) {
      console.error('Failed to save Stripe status to localStorage:', error);
    }
  }, []);

  // Clear all Stripe data (for testing)
  const clearStripeData = useCallback(() => {
    updateStripeAccountId('');
    updateStripeAccountStatus({
      canReceivePayments: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
    });
    localStorage.removeItem('stripeAccountId');
    localStorage.removeItem('stripeAccountStatus');
  }, [updateStripeAccountId, updateStripeAccountStatus]);
  
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([
    { id: '1', name: 'Infants', description: '0-12 months', selected: true },
    { id: '2', name: 'Toddlers', description: '1-3 years', selected: true },
    { id: '3', name: 'Preschoolers', description: '3-5 years', selected: false },
    { id: '4', name: 'School Age', description: '5+ years', selected: false }
  ]);

  const [specialties, setSpecialties] = useState<Specialty[]>([
    { id: '1', name: 'Potty Training', selected: true },
    { id: '2', name: 'Sleep Training', selected: false },
    { id: '3', name: 'Special Needs', selected: false },
    { id: '4', name: 'Bilingual Care', selected: false },
    { id: '5', name: 'Meal Preparation', selected: true },
    { id: '6', name: 'Educational Activities', selected: true },
    { id: '7', name: 'Outdoor Play', selected: false },
    { id: '8', name: 'Arts & Crafts', selected: false }
  ]);

  const [services, setServices] = useState<CaregiverService[]>([
    { id: 'FULL_DAY', type: 'DAYCARE', name: 'Full-day care', description: 'Full day childcare services', selected: false },
    { id: 'HALF_DAY', type: 'BABYSITTING', name: 'Half-day care', description: 'Morning or afternoon care', selected: false },
    { id: 'BEFORE_AFTER_SCHOOL', type: 'AFTER_SCHOOL', name: 'Before/after school care', description: 'School drop-off and pick-up care', selected: false },
    { id: 'OVERNIGHT', type: 'OVERNIGHT', name: 'Overnight care', description: 'Evening and overnight stays', selected: false },
    { id: 'DROP_IN', type: 'NANNY', name: 'Drop-in care', description: 'Flexible short-notice care', selected: false }
  ]);
  const [savingServices, setSavingServices] = useState(false);
  const [savingAgeGroups, setSavingAgeGroups] = useState(false);
  const [savingSpecialties, setSavingSpecialties] = useState(false);

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    {
      id: '1',
      day: 'Monday',
      startTime: '08:00',
      endTime: '17:00',
      spotsAvailable: 3,
      recurring: true
    },
    {
      id: '2',
      day: 'Wednesday',
      startTime: '09:00',
      endTime: '15:00',
      spotsAvailable: 2,
      recurring: false
    },
    {
      id: '3',
      day: 'Friday',
      startTime: '08:30',
      endTime: '16:30',
      spotsAvailable: 4,
      recurring: true
    }
  ]);

  const [photos, setPhotos] = useState<DaycarePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

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

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Chat modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedChatBooking, setSelectedChatBooking] = useState<Booking | null>(null);

  // Child details modal state
  const [showChildDetailsModal, setShowChildDetailsModal] = useState(false);
  const [selectedChildDetailsBooking, setSelectedChildDetailsBooking] = useState<Booking | null>(null);

  // Booking status filter state
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Booking extension modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [extensionReason, setExtensionReason] = useState('');
  const [isExtending, setIsExtending] = useState(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  // Calculate booking counts by status
  const pendingBookingCount = useMemo(() => bookings.filter(b => b.status === "PENDING").length, [bookings]);
  const confirmedBookingCount = useMemo(() => bookings.filter(b => b.status === "CONFIRMED").length, [bookings]);
  const inProgressBookingCount = useMemo(() => bookings.filter(b => b.status === "IN_PROGRESS").length, [bookings]);
  const completedBookingCount = useMemo(() => bookings.filter(b => b.status === "COMPLETED").length, [bookings]);
  const cancelledBookingCount = useMemo(() => bookings.filter(b => b.status === "CANCELLED").length, [bookings]);

  // Filter bookings based on selected status
  const filteredBookings = useMemo(() => bookingStatusFilter === 'ALL'
    ? bookings
    : bookings.filter(b => b.status === bookingStatusFilter), [bookings, bookingStatusFilter]);

  // Memoized earnings calculations for the Payments tab
  const totalEarnings = useMemo(() =>
    (bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + b.totalAmount, 0) / 100).toFixed(2),
    [bookings]
  );
  const pendingPayouts = useMemo(() =>
    (bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS').reduce((sum, b) => sum + b.totalAmount, 0) / 100).toFixed(2),
    [bookings]
  );

  const addTimeSlot = useCallback((slot: Omit<TimeSlot, 'id'>) => {
    const newSlot = {
      ...slot,
      id: Date.now().toString()
    };
    setTimeSlots(prev => [...prev, newSlot]);
    setShowAddSlot(false);
  }, []);

  const updateTimeSlot = useCallback((updatedSlot: TimeSlot) => {
    setTimeSlots(prev => prev.map(slot =>
      slot.id === updatedSlot.id ? updatedSlot : slot
    ));
    setEditingSlot(null);
  }, []);

  const deleteTimeSlot = useCallback((id: string) => {
    setTimeSlots(prev => prev.filter(slot => slot.id !== id));
  }, []);

  const handleRateEdit = useCallback(() => {
    setTempRate(hourlyRate);
    setIsEditingRate(true);
  }, [hourlyRate]);

  const saveRate = useCallback(async () => {
    if (!caregiverId) return;

    try {
      const response = await fetch(`/api/caregivers/${caregiverId}`, {
        method: "PATCH",
        headers: addCSRFHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ hourlyRate: tempRate })
      });

      if (response.ok) {
        setHourlyRate(tempRate);
        setIsEditingRate(false);
      } else {
        console.error("Failed to save rate");
        alert("Failed to save rate. Please try again.");
      }
    } catch (error) {
      console.error("Error saving rate:", error);
      alert("Failed to save rate. Please try again.");
    }
  }, [caregiverId, tempRate]);

  const cancelRateEdit = useCallback(() => {
    setTempRate(hourlyRate);
    setIsEditingRate(false);
  }, [hourlyRate]);

  const toggleAgeGroup = useCallback(async (id: string) => {
    const updatedAgeGroups = ageGroups.map(group =>
      group.id === id ? { ...group, selected: !group.selected } : group
    );
    setAgeGroups(updatedAgeGroups);

    // Auto-save to database
    if (!caregiverId) return;

    try {
      setSavingAgeGroups(true);
      const selectedAgeGroups = updatedAgeGroups.filter(g => g.selected).map(g => ({
        id: g.id,
        name: g.name,
        description: g.description
      }));

      const response = await fetch(`/api/caregivers/${caregiverId}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ageGroups: selectedAgeGroups })
      });

      if (!response.ok) {
        console.error('Failed to save age groups');
      }
    } catch (error) {
      console.error('Error saving age groups:', error);
    } finally {
      setSavingAgeGroups(false);
    }
  }, [ageGroups, caregiverId]);

  const toggleSpecialty = useCallback(async (id: string) => {
    const updatedSpecialties = specialties.map(specialty =>
      specialty.id === id ? { ...specialty, selected: !specialty.selected } : specialty
    );
    setSpecialties(updatedSpecialties);

    // Auto-save to database
    if (!caregiverId) return;

    try {
      setSavingSpecialties(true);
      const selectedSpecialties = updatedSpecialties.filter(s => s.selected).map(s => s.name);

      const response = await fetch(`/api/caregivers/${caregiverId}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ specialties: selectedSpecialties })
      });

      if (!response.ok) {
        console.error('Failed to save specialties');
      }
    } catch (error) {
      console.error('Error saving specialties:', error);
    } finally {
      setSavingSpecialties(false);
    }
  }, [specialties, caregiverId]);


  const toggleService = useCallback(async (id: string) => {
    const updatedServices = services.map(service =>
      service.id === id ? { ...service, selected: !service.selected } : service
    );
    setServices(updatedServices);

    // Auto-save to database
    if (!caregiverId) return;

    try {
      setSavingServices(true);
      const selectedServices = updatedServices.filter(s => s.selected).map(s => s.type);

      const response = await fetch('/api/caregiver/services', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          caregiverId,
          services: selectedServices
        })
      });

      if (!response.ok) {
        console.error('Failed to save services');
      }
    } catch (error) {
      console.error('Error saving services:', error);
    } finally {
      setSavingServices(false);
    }
  }, [services, caregiverId]);
  
  const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: formData,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfilePhoto(data.data?.avatarUrl);
        // Refresh user context to update header
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
        alert('Profile picture uploaded successfully!');
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
  }, []);

  // Address saving function
  const handleSaveAddress = useCallback(async () => {
    setSavingAddress(true);
    try {
      const response = await fetch('/api/profile/update-address', {
        method: 'PATCH',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(addressData),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();

        // Update local addressData state with the saved data
        if (result.data?.profile) {
          setAddressData({
            streetAddress: result.data.profile.streetAddress || '',
            apartment: result.data.profile.apartment || '',
            city: result.data.profile.city || '',
            state: result.data.profile.state || '',
            zipCode: result.data.profile.zipCode || '',
            country: result.data.profile.country || 'US'
          });
        }
        
        setIsEditingAddress(false);
        alert('Address updated successfully!');
        
        // Refresh user context in the background
        // await refreshUser(); // Commented out - causes apartment to disappear due to useEffect overwriting state
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update address');
      }
    } catch (error) {
      console.error('Address update error:', error);
      alert('Failed to update address');
    } finally {
      setSavingAddress(false);
    }
  }, [addressData]);

  const handleCancelAddressEdit = useCallback(() => {
    setAddressData({
      streetAddress: user?.profile?.streetAddress || '',
      apartment: user?.profile?.apartment || '',
      city: user?.profile?.city || '',
      state: user?.profile?.province || user?.profile?.state || '',
      zipCode: user?.profile?.postalCode || user?.profile?.zipCode || '',
      country: user?.profile?.country || 'US'
    });
    setIsEditingAddress(false);
  }, [user?.profile]);

  // About Me save function
  const handleSaveBio = useCallback(async () => {
    if (!caregiverId) return;

    setSavingBio(true);
    try {
      const response = await fetch(`/api/caregivers/${caregiverId}`, {
        method: 'PATCH',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          bio: bio.trim(),
          experienceYears: experienceYears
        }),
        credentials: 'include',
      });

      if (response.ok) {
        setIsEditingBio(false);
        alert('Profile updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Bio update error:', error);
      alert('Failed to update profile');
    } finally {
      setSavingBio(false);
    }
  }, [caregiverId, bio, experienceYears]);

  const handleCancelBioEdit = () => {
    // Reset to original values
    fetchCaregiverProfile();
    setIsEditingBio(false);
  };

  // Stripe Connect functions
  const handleStripeOnboarding = useCallback(async () => {
    if (!user) {
      alert('User information not available. Please try refreshing the page.');
      return;
    }

    setIsLoadingStripe(true);

    try {
      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        credentials: 'include',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          userId: user.id,
          caregiverName: user.name,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create onboarding session');
      }

      const stripeData = data.data;

      if (stripeData?.accountId) {
        updateStripeAccountId(stripeData.accountId);
      }

      // Demo mode: still redirect
      if (stripeData?.demo && stripeData?.onboardingUrl) {
        setShowRedirectLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.location.href = stripeData.onboardingUrl;
        return;
      }

      // Real mode: show inline embedded onboarding
      if (stripeData?.accountId) {
        setInlineAccountId(stripeData.accountId);
        setShowInlineOnboarding(true);
      }
    } catch (error) {
      console.error('Error creating Stripe onboarding:', error);
      alert(error instanceof Error ? error.message : 'Failed to start payment setup');
    } finally {
      setIsLoadingStripe(false);
    }
  }, [user, updateStripeAccountId]);

  const checkStripeAccountStatus = useCallback(async (accountId: string) => {
    try {
      const response = await fetch('/api/stripe/connect/status', {
        method: 'POST',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();
      const statusData = data.data;

      if (statusData?.accountId) {
        updateStripeAccountStatus({
          canReceivePayments: statusData.canReceivePayments,
          chargesEnabled: statusData.chargesEnabled,
          detailsSubmitted: statusData.detailsSubmitted,
          payoutsEnabled: statusData.payoutsEnabled,
          requirements: statusData.requirements || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to check Stripe account status:', error);
    }
  }, [updateStripeAccountStatus]);

  const handleOnboardingComplete = useCallback(() => {
    setShowInlineOnboarding(false);
    setInlineAccountId(null);
    setShowSuccessModal(true);
    setActiveTab('payments');
    if (stripeAccountId) {
      checkStripeAccountStatus(stripeAccountId);
    }
  }, [stripeAccountId, checkStripeAccountStatus]);

  // Helper to convert Stripe requirement codes to human-readable messages
  const getRequirementMessage = useCallback((requirement: string): string => {
    const requirementMessages: { [key: string]: string } = {
      'individual.verification.proof_of_liveness': 'Identity verification (selfie photo) required',
      'individual.verification.document': 'Government ID document required',
      'individual.verification.additional_document': 'Additional identity document required',
      'individual.id_number': 'Social Insurance Number (SIN) required',
      'individual.ssn_last_4': 'Last 4 digits of SIN/SSN required',
      'individual.address.city': 'City is required',
      'individual.address.line1': 'Street address is required',
      'individual.address.postal_code': 'Postal code is required',
      'individual.address.state': 'Province/State is required',
      'individual.dob.day': 'Date of birth (day) required',
      'individual.dob.month': 'Date of birth (month) required',
      'individual.dob.year': 'Date of birth (year) required',
      'individual.email': 'Email address required',
      'individual.first_name': 'First name required',
      'individual.last_name': 'Last name required',
      'individual.phone': 'Phone number required',
      'external_account': 'Bank account information required',
      'business_profile.url': 'Business website URL required',
      'business_profile.mcc': 'Business category required',
      'tos_acceptance.date': 'Terms of service acceptance required',
      'tos_acceptance.ip': 'Terms of service acceptance required',
    };

    return requirementMessages[requirement] || requirement.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, []);

  // Check account status when component mounts or when stripeAccountId changes
  useEffect(() => {
    if (stripeAccountId) {
      checkStripeAccountStatus(stripeAccountId);
    }
  }, [stripeAccountId]);

  // Auto-refresh account status every 30 seconds if account exists but setup is not complete
  useEffect(() => {
    if (stripeAccountId && !stripeAccountStatus.canReceivePayments) {
      const interval = setInterval(() => {
        checkStripeAccountStatus(stripeAccountId);
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [stripeAccountId, stripeAccountStatus.canReceivePayments]);

  // Handle Stripe Connect onboarding return
  useEffect(() => {
    if (!searchParams) return;
    
    const setup = searchParams.get('setup');
    const demo = searchParams.get('demo');
    
    if (setup === 'success') {
      // Show success modal
      setShowSuccessModal(true);

      // Switch to payments tab to show the result
      setActiveTab('payments');
      
      if (demo === 'true') {
        // Demo mode success - simulate complete setup
        console.log('Demo onboarding success detected');
        updateStripeAccountStatus({
          canReceivePayments: true,
          chargesEnabled: true,
          detailsSubmitted: true,
          payoutsEnabled: true,
        });
      } else if (stripeAccountId) {
        // Real mode - refresh account status
        console.log('Real Stripe onboarding success detected');
        checkStripeAccountStatus(stripeAccountId);
      }
      
      // Clean URL by removing parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (setup === 'failed') {
      setActiveTab('payments');
      console.log('Stripe onboarding failed or was cancelled');
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [searchParams, stripeAccountId]);

  const TimeSlotForm = ({ 
    slot, 
    onSave, 
    onCancel 
  }: { 
    slot?: TimeSlot; 
    onSave: (slot: TimeSlot | Omit<TimeSlot, 'id'>) => void; 
    onCancel: () => void 
  }) => {
    const [formData, setFormData] = useState({
      day: slot?.day || 'Monday',
      startTime: slot?.startTime || '08:00',
      endTime: slot?.endTime || '17:00',
      spotsAvailable: slot?.spotsAvailable || 1,
      recurring: slot?.recurring || false
    });

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {slot ? 'Edit Time Slot' : 'Add Time Slot'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Day</label>
              <select
                value={formData.day}
                onChange={(e) => setFormData(prev => ({ ...prev, day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Spots</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.spotsAvailable}
                onChange={(e) => setFormData(prev => ({ ...prev, spotsAvailable: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                placeholder="Number of children you can care for"
              />
            </div>

            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.recurring}
                onChange={(e) => setFormData(prev => ({ ...prev, recurring: e.target.checked }))}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded transition-colors"
              />
              <label htmlFor="recurring" className="ml-3 text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                Recurring weekly
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (slot) {
                  onSave({ ...slot, ...formData });
                } else {
                  onSave(formData);
                }
              }}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Show loading state only while authentication is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If auth is done loading but user is not authenticated or not a caregiver, show loading while redirect happens
  // EXCEPTION: Allow non-caregivers who are completing OAuth caregiver signup to proceed
  const isOAuthCaregiverSignup = searchParams.get('oauth') === 'true' && searchParams.get('userType') === 'caregiver';
  const hasCaregiverStorageFlag = typeof window !== 'undefined' && localStorage.getItem('oauthSignupUserType') === 'caregiver';
  const isCompletingCaregiverOAuth = isOAuthCaregiverSignup || hasCaregiverStorageFlag;

  if (!isAuthenticated || (!isCaregiver && !isCompletingCaregiverOAuth) || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  // If user is a babysitter, show the babysitter dashboard instead
  if (user.isBabysitter) {
    return <BabysitterDashboard />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Caregiver Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notification Bell Icon */}
              <div className="relative notification-dropdown-container">
                <BellIcon
                  className="h-6 w-6 text-gray-600 dark:text-gray-300 cursor-pointer hover:text-green-600 dark:hover:text-green-400"
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                />
                {realUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {realUnreadCount}
                  </span>
                )}

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Notifications
                          {realUnreadCount > 0 && (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                              ({realUnreadCount} new)
                            </span>
                          )}
                        </h3>
                      </div>
                      {notifications.length > 0 && (
                        <div className="flex items-center space-x-2">
                          {realUnreadCount > 0 && (
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
                                markAsRead(notification.id);
                              }
                              setShowNotificationDropdown(false);
                              if (notification.type === 'booking' || notification.type === 'caregiver') {
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
                                {notification.type === 'booking' || notification.type === 'caregiver' ? (
                                  <CalendarDaysIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                ) : notification.type === 'message' ? (
                                  <ChatBubbleLeftRightIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : notification.type === 'payment' ? (
                                  <CreditCardIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
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
                          <BellIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
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

              <Link
                href="/search"
                className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                <EyeIcon className="h-5 w-5 mr-1" />
                View My Profile
              </Link>
              <div className="flex items-center space-x-3">
                {user && (
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <CaregiverProfileImage
                      name={`${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`}
                      id={user.id}
                      imageUrl={profilePhoto || user?.profile?.avatar || undefined}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  </div>
                )}
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
        {/* Profile Completion Banner */}
        <ProfileCompletionBanner />

        <NotificationInitializer />
        {/* Profile Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <CaregiverProfileImage
                  name={`${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`}
                  id={user?.id || ''}
                  imageUrl={profilePhoto || user?.profile?.avatar || undefined}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'Caregiver'}
                </h2>
                <div className="flex items-center mt-1">
                  <MapPinIcon className="h-4 w-4 text-gray-400 mr-1" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {user?.profile?.city && user?.profile?.state
                      ? `${user.profile.city}, ${user.profile.state}`
                      : 'Location not provided'}
                  </span>
                </div>
                <div className="flex items-center mt-1">
                  <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                  <span className="text-gray-900 dark:text-white font-medium">{user?.caregiver?.averageRating?.toFixed(1) || "No rating"}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">({user?._count?.receivedReviews || 0} {user?._count?.receivedReviews === 1 ? 'review' : 'reviews'})</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              {isEditingRate ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">$</span>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={tempRate}
                      onChange={(e) => setTempRate(parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xl font-bold text-green-600 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-green-400 rounded focus:ring-green-500 focus:border-green-500"
                      autoFocus
                    />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">/hour</span>
                  </div>
                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={cancelRateEdit}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveRate}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div 
                    className="text-2xl font-bold text-green-600 cursor-pointer hover:text-green-700 transition flex items-center"
                    onClick={handleRateEdit}
                  >
                    ${hourlyRate}/hour
                    <PencilIcon className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Click to edit rate
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 flex-wrap">
          <button
            onClick={() => handleTabChange('profile')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'profile' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PhotoIcon className="h-5 w-5 inline-block mr-2" />
            Profile
          </button>
          <button
            onClick={() => handleTabChange('schedule')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'schedule' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarDaysIcon className="h-5 w-5 inline-block mr-2" />
            Schedule & Availability
          </button>
          <button
            onClick={() => handleTabChange('bookings')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              activeTab === 'bookings' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline-block mr-2" />
            Bookings
            {pendingBookingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {pendingBookingCount > 9 ? '9+' : pendingBookingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('messages')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              activeTab === 'messages' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5 inline-block mr-2" />
            Messages
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('preferences')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'preferences' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UserGroupIcon className="h-5 w-5 inline-block mr-2" />
            Care Preferences
          </button>
          <button
            onClick={() => handleTabChange('photos')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'photos' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PhotoIcon className="h-5 w-5 inline-block mr-2" />
            Daycare Photos
          </button>
          <button
            onClick={() => handleTabChange('payments')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'payments' 
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CreditCardIcon className="h-5 w-5 inline-block mr-2" />
            Payments & Payouts
          </button>
          <button
            onClick={() => handleTabChange('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'analytics'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ChartBarIcon className="h-5 w-5 inline-block mr-2" />
            Analytics
          </button>
          <button
            onClick={() => handleTabChange('support')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'support'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <QuestionMarkCircleIcon className="h-5 w-5 inline-block mr-2" />
            Support
          </button>
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Bookings</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {filteredBookings.length} of {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={fetchBookings}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setBookingStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'ALL'
                      ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All ({bookings.length})
                </button>
                <button
                  onClick={() => setBookingStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'PENDING'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700'
                  }`}
                >
                  Pending ({pendingBookingCount})
                </button>
                <button
                  onClick={() => setBookingStatusFilter('CONFIRMED')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'CONFIRMED'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700'
                  }`}
                >
                  Confirmed ({confirmedBookingCount})
                </button>
                <button
                  onClick={() => setBookingStatusFilter('IN_PROGRESS')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'IN_PROGRESS'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-700'
                  }`}
                >
                  In Progress ({inProgressBookingCount})
                </button>
                <button
                  onClick={() => setBookingStatusFilter('COMPLETED')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'COMPLETED'
                      ? 'bg-gray-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  Completed ({completedBookingCount})
                </button>
                <button
                  onClick={() => setBookingStatusFilter('CANCELLED')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    bookingStatusFilter === 'CANCELLED'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-700'
                  }`}
                >
                  Cancelled ({cancelledBookingCount})
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mr-3"></div>
                  <span className="text-gray-600 dark:text-gray-300">Loading bookings...</span>
                </div>
              ) : bookingError ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Bookings</h3>
                  <p className="text-gray-500 text-sm mb-4">{bookingError}</p>
                  <button
                    onClick={fetchBookings}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">
                    {bookings.length === 0 ? 'No bookings yet' : `No ${bookingStatusFilter.toLowerCase().replace('_', ' ')} bookings`}
                  </p>
                  <p className="text-sm">
                    {bookings.length === 0
                      ? 'Your confirmed bookings will appear here'
                      : 'Try selecting a different filter above'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Booking with {booking.parentName}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'PENDING' && isBookingExpired(booking.startTime) ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700' :
                              booking.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700' :
                              booking.status === 'CONFIRMED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700' :
                              booking.status === 'IN_PROGRESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700' :
                              booking.status === 'COMPLETED' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600' :
                              'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
                            }`}>
                              {booking.status === 'PENDING' && isBookingExpired(booking.startTime)
                                ? 'expired'
                                : booking.status.toLowerCase()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300 mb-3">
                            <div className="flex items-center">
                              <CalendarDaysIcon className="h-4 w-4 mr-2" />
                              <span>
                                {new Date(booking.startTime).toLocaleDateString('en-US', { timeZone: userTimezone })} • {' '}
                                {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone })} - {' '}
                                {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone })}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => {
                                setSelectedChildDetailsBooking(booking);
                                setShowChildDetailsModal(true);
                              }}
                              className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors group cursor-pointer"
                            >
                              <UserGroupIcon className="h-4 w-4 mr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                              <span className="underline underline-offset-2 decoration-dashed">{booking.childrenCount} child{booking.childrenCount !== 1 ? 'ren' : ''}</span>
                              <span className="ml-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">(view)</span>
                            </button>
                            
                            <div className="flex items-center">
                              <MapPinIcon className="h-4 w-4 mr-2" />
                              <span className="truncate">{booking.address}</span>
                            </div>
                            
                            <div className="flex items-center">
                              <BanknotesIcon className="h-4 w-4 mr-2" />
                              <span className="font-medium text-green-600">
                                ${(booking.totalAmount / 100).toFixed(2)} ({booking.totalHours}h × ${booking.hourlyRate > 100 ? (booking.hourlyRate / 100).toFixed(0) : booking.hourlyRate}/hr)
                              </span>
                            </div>
                          </div>

                          {booking.specialRequests && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                <strong>Special requests:</strong> {booking.specialRequests}
                              </p>
                            </div>
                          )}

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Requested: {new Date(booking.requestedAt).toLocaleString()}
                            {booking.confirmedAt && (
                              <span> • Confirmed: {new Date(booking.confirmedAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {booking.status === 'PENDING' && (
                          <div className="ml-4 flex flex-col space-y-2">
                            {/* Past PENDING bookings - show expired message */}
                            {isBookingExpired(booking.startTime) ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedChatBooking(booking);
                                    setShowChatModal(true);
                                    clearCountForBooking(booking.id);
                                  }}
                                  className="relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-sm font-medium shadow-sm flex items-center justify-center"
                                >
                                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
                                  Message
                                  {getCountForBooking(booking.id) > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                      {getCountForBooking(booking.id) > 9 ? '9+' : getCountForBooking(booking.id)}
                                    </span>
                                  )}
                                </button>
                                <span className="text-xs text-orange-600 dark:text-orange-400 text-center">
                                  Booking date has passed
                                </span>
                              </>
                            ) : (
                              /* Future PENDING bookings - show paid status with message option */
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedChatBooking(booking);
                                    setShowChatModal(true);
                                    clearCountForBooking(booking.id);
                                  }}
                                  className="relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-sm font-medium shadow-sm flex items-center justify-center"
                                >
                                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
                                  Message
                                  {getCountForBooking(booking.id) > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                      {getCountForBooking(booking.id) > 9 ? '9+' : getCountForBooking(booking.id)}
                                    </span>
                                  )}
                                </button>
                                <span className="text-xs text-green-600 dark:text-green-400 text-center">
                                  ✓ Paid - Awaiting service
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {booking.status === 'CONFIRMED' && (
                          <div className="ml-4 flex flex-col space-y-2">
                            <button
                              onClick={() => {
                                setSelectedChatBooking(booking);
                                setShowChatModal(true);
                                clearCountForBooking(booking.id);
                              }}
                              className="relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-sm font-medium shadow-sm flex items-center justify-center"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
                              Message
                              {getCountForBooking(booking.id) > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                  {getCountForBooking(booking.id) > 9 ? '9+' : getCountForBooking(booking.id)}
                                </span>
                              )}
                            </button>
                            {new Date(booking.startTime) <= new Date() && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'IN_PROGRESS')}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                              >
                                Start
                              </button>
                            )}
                          </div>
                        )}
                        
                        {booking.status === 'IN_PROGRESS' && (
                          <div className="ml-4 flex flex-col space-y-2">
                            <button
                              onClick={() => {
                                setSelectedChatBooking(booking);
                                setShowChatModal(true);
                                clearCountForBooking(booking.id);
                              }}
                              className="relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-sm font-medium shadow-sm flex items-center justify-center"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
                              Message
                              {getCountForBooking(booking.id) > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                  {getCountForBooking(booking.id) > 9 ? '9+' : getCountForBooking(booking.id)}
                                </span>
                              )}
                            </button>
                            {/* Show Extend button when booking end time has passed */}
                            {new Date(booking.endTime) <= new Date() && (
                              <button
                                onClick={() => {
                                  setSelectedExtendBooking(booking);
                                  setExtensionMinutes(30);
                                  setExtensionReason('');
                                  setExtensionError(null);
                                  setShowExtendModal(true);
                                }}
                                className="px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm flex items-center justify-center"
                              >
                                <ClockIcon className="h-4 w-4 mr-1" />
                                Extend
                              </button>
                            )}
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'COMPLETED')}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              Complete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && user && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow min-h-[600px] h-[calc(100vh-12rem)]">
            <OrganizedMessagesContainer
              userId={user.id}
              userType="caregiver"
              onMessageRead={(count) => decrementMessageCount(count)}
              onRefreshCount={refreshMessageCount}
              userAvatar={user.profile?.avatar}
              userName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.name || 'Caregiver'}
            />
          </div>
        )}

        {/* Care Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Services I Offer */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Services I Offer</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Select the types of childcare services you provide
                    </p>
                  </div>
                  {savingServices && (
                    <span className="text-sm text-blue-600 dark:text-blue-400">Saving...</span>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                        service.selected
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{service.description}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          service.selected
                            ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-500'
                            : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600'
                        }`}>
                          {service.selected && (
                            <span className="text-white text-sm">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Selected:</strong> {services.filter(s => s.selected).map(s => s.name).join(', ') || 'None selected - please select at least one service'}
                  </p>
                </div>
              </div>
            </div>

            {/* Age Groups */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Age Groups I Care For</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  Select the age ranges you're comfortable caring for
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ageGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => toggleAgeGroup(group.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                        group.selected
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{group.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{group.description}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          group.selected
                            ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-500'
                            : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600'
                        }`}>
                          {group.selected && (
                            <span className="text-white text-sm">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Specialties */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Specialties</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  Highlight your special skills and services
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {specialties.map((specialty) => (
                    <button
                      key={specialty.id}
                      onClick={() => toggleSpecialty(specialty.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                        specialty.selected
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {specialty.name}
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start">
                    <TagIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-200">Selected Specialties</h4>
                      <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                        {specialties.filter(s => s.selected).map(s => s.name).join(', ') || 'None selected'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Settings</h3>
              
              <div className="flex items-center space-x-8">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                      <CaregiverProfileImage
                        name={`${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`}
                        id={user?.id || ''}
                        imageUrl={profilePhoto || user?.profile?.avatar || undefined}
                        width={128}
                        height={128}
                        className="rounded-full"
                      />
                    </div>
                    
                    <input
                      type="file"
                      id="avatar-upload-caregiver"
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    <label
                      htmlFor="avatar-upload-caregiver"
                      className="absolute bottom-0 right-0 h-10 w-10 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center shadow-lg cursor-pointer"
                    >
                      {uploadingAvatar ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <PencilIcon className="h-5 w-5" />
                      )}
                    </label>
                  </div>
                </div>
                
                {/* Profile Info */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {user?.profile?.firstName} {user?.profile?.lastName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">{user?.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Upload a professional photo to build trust with parents
                    </p>
                  </div>
                </div>
              </div>
              
              {/* About Me Section */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">About Me</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tell parents about yourself, your experience, and your approach to childcare
                    </p>
                  </div>
                  {!isEditingBio && (
                    <button
                      onClick={() => setIsEditingBio(true)}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <PencilIcon className="h-4 w-4 mr-2" />
                      {bio || experienceYears > 0 ? 'Edit Bio' : 'Add Bio'}
                    </button>
                  )}
                </div>

                {isEditingBio ? (
                  <div className="space-y-4">
                    {/* Experience Years */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        How many years have you been providing childcare?
                      </p>
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        About Me
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={500}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        placeholder="Tell parents about your experience, qualifications, and approach to childcare. What makes you special? What do you enjoy about working with children?"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Share your passion for childcare, certifications, and what makes you unique
                        </p>
                        <span className="text-xs text-gray-400">
                          {bio.length}/500
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        onClick={handleCancelBioEdit}
                        disabled={savingBio}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBio}
                        disabled={savingBio}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center"
                      >
                        {savingBio ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          'Save Profile'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    {experienceYears > 0 && (
                      <div className="flex items-center mb-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          {experienceYears} year{experienceYears !== 1 ? 's' : ''} of experience
                        </span>
                      </div>
                    )}
                    
                    {bio ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {bio}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <DocumentTextIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">
                          No bio added yet
                        </p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm">
                          Add your bio to help parents get to know you better
                        </p>
                      </div>
                    )}
                    
                    {(!bio || experienceYears === 0) && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Complete your bio to build trust with parents and increase booking requests
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Address Section */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Address Information</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your address helps parents find caregivers in their area
                    </p>
                  </div>
                  {!isEditingAddress && (
                    <button
                      onClick={() => setIsEditingAddress(true)}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit Address
                    </button>
                  )}
                </div>

                {isEditingAddress ? (
                  <div className="space-y-4">
                    {/* Address Autocomplete */}
                    <MapboxAddressAutocomplete
                      defaultValue={addressData.streetAddress ? 
                        [
                          addressData.streetAddress,
                          addressData.city,
                          addressData.state,
                          addressData.zipCode
                        ].filter(Boolean).filter(val => val !== 'Not provided').join(', ') : 
                        ''
                      }
                      label="Start typing your address"
                      placeholder="e.g., 235 Sherway Gardens Rd, Etobicoke"
                      onAddressSelect={(address) => {
                        // Update all address fields at once
                        setAddressData({
                          streetAddress: address.streetAddress,
                          apartment: address.apartment || '',
                          city: address.city,
                          state: address.state,
                          zipCode: address.zipCode,
                          country: address.country || 'Canada'
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
                        value={addressData.apartment}
                        onChange={(e) => setAddressData({
                          ...addressData,
                          apartment: e.target.value
                        })}
                        placeholder="e.g., Apt 1A, Unit 205"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
                    </div>

                    {/* Show selected address preview */}
                    {(addressData.streetAddress || addressData.city || addressData.state || addressData.zipCode) && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Selected Address:</div>
                        <div className="text-sm text-gray-800 dark:text-gray-200">
                          {addressData.streetAddress && (
                            <div>
                              {addressData.streetAddress}
                              {addressData.apartment && `, ${addressData.apartment}`}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {addressData.city && <span>{addressData.city}</span>}
                            {addressData.state && <span>{addressData.state}</span>}
                            {addressData.zipCode && <span>{addressData.zipCode}</span>}
                          </div>
                        </div>
                      </div>
                    )}


                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        onClick={handleCancelAddressEdit}
                        disabled={savingAddress}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAddress}
                        disabled={savingAddress}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center"
                      >
                        {savingAddress ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          'Save Address'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-gray-900 dark:text-white">
                          {addressData.streetAddress || 'No street address provided'}
                          {addressData.apartment && `, ${addressData.apartment}`}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-4 mr-2"></span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {addressData.city && addressData.state 
                            ? `${addressData.city}, ${addressData.state} ${addressData.zipCode}` 
                            : 'No city/state provided'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-4 mr-2"></span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {addressData.country === 'US' ? 'United States' : 'Canada'}
                        </span>
                      </div>
                    </div>
                    
                    {(!addressData.streetAddress || !addressData.city || !addressData.state) && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Complete your address to help parents find you in their area
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6">
              {/* Get caregiver ID from the caregiver profile */}
              {caregiverLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p>Loading availability manager...</p>
                </div>
              ) : caregiverId ? (
                <SimpleScheduleBuilder 
                  caregiverId={caregiverId}
                  defaultCapacity={6}
                  defaultRate={hourlyRate}
                />
              ) : (
                <div className="text-center py-8 text-red-500">
                  <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unable to load caregiver profile</h3>
                  {caregiverError && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Error: {caregiverError}
                    </p>
                  )}
                  <p className="text-sm mb-4">
                    Please ensure you're logged in as a caregiver and try refreshing the page.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Refresh Page
                  </button>
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6">
              <PhotoUpload 
                photos={photos} 
                onPhotosChange={setPhotos}
              />
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Stripe Connect Setup */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Setup</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  Connect your bank account to receive payments from bookings
                </p>
              </div>

              <div className="p-6">
                {!stripeAccountId ? (
                  <div className="text-center py-8">
                    <CreditCardIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Connect Your Bank Account
                    </h4>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Set up secure payments through Stripe to receive earnings from your bookings. 
                      The setup takes just a few minutes.
                    </p>
                    {!showInlineOnboarding ? (
                      <button
                        onClick={handleStripeOnboarding}
                        disabled={isLoadingStripe}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition flex items-center justify-center mx-auto"
                      >
                        {isLoadingStripe ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                            Setting up...
                          </>
                        ) : (
                          <>
                            <BanknotesIcon className="h-5 w-5 mr-2" />
                            Connect Bank Account
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setShowInlineOnboarding(false); setInlineAccountId(null); }}
                        className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition mx-auto"
                      >
                        Cancel Setup
                      </button>
                    )}

                    {/* Inline Stripe Embedded Onboarding */}
                    {showInlineOnboarding && inlineAccountId && (
                      <div className="mt-6 border dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-900/50 text-left">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Complete Your Payment Setup</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Complete the form below to start receiving payments. Your information is securely handled by Stripe.
                        </p>
                        <StripeConnectOnboarding
                          stripeAccountId={inlineAccountId}
                          onExit={handleOnboardingComplete}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Account Status</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Stripe Account ID: {stripeAccountId}</p>
                        {stripeAccountId.startsWith('acct_demo_') ? (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">⚠️ Demo account - Complete setup to receive real payments</p>
                        ) : (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Connection saved - persists after refresh</p>
                        )}
                      </div>
                      <button
                        onClick={() => checkStripeAccountStatus(stripeAccountId)}
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
                      >
                        Refresh Status
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.detailsSubmitted
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      }`}>
                        <div className="flex items-center">
                          {stripeAccountStatus.detailsSubmitted ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          ) : (
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Details</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {stripeAccountStatus.detailsSubmitted ? 'Complete' : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.chargesEnabled
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      }`}>
                        <div className="flex items-center">
                          {stripeAccountStatus.chargesEnabled ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          ) : (
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Payments</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {stripeAccountStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.payoutsEnabled
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      }`}>
                        <div className="flex items-center">
                          {stripeAccountStatus.payoutsEnabled ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          ) : (
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Payouts</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {stripeAccountStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.canReceivePayments
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                      }`}>
                        <div className="flex items-center">
                          {stripeAccountStatus.canReceivePayments ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          ) : (
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Status</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {stripeAccountStatus.canReceivePayments ? 'Ready' : 'Setup Required'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Show warning if: not ready for payments, OR payouts disabled, OR has outstanding requirements */}
                    {(!stripeAccountStatus.canReceivePayments || !stripeAccountStatus.payoutsEnabled || (stripeAccountStatus.requirements?.currently_due && stripeAccountStatus.requirements.currently_due.length > 0)) && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-start">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                              {stripeAccountId.startsWith('acct_demo_')
                                ? 'Demo Account - Real Setup Required'
                                : !stripeAccountStatus.payoutsEnabled && stripeAccountStatus.canReceivePayments
                                  ? 'Payouts Disabled - Action Required'
                                  : 'Setup Required'}
                            </h4>
                            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                              {stripeAccountId.startsWith('acct_demo_')
                                ? 'You are currently using a demo account. To receive real payments from bookings, you need to complete the Stripe Connect setup with your bank account details.'
                                : !stripeAccountStatus.payoutsEnabled && stripeAccountStatus.canReceivePayments
                                  ? 'You can accept payments, but payouts to your bank account are disabled until you complete the required verification steps below.'
                                  : 'Complete your Stripe setup to start receiving payments.'}
                            </p>

                            {/* Show specific requirements if available */}
                            {!stripeAccountId.startsWith('acct_demo_') && stripeAccountStatus.requirements?.currently_due && stripeAccountStatus.requirements.currently_due.length > 0 && (
                              <div className="mt-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-md p-3">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                                  Action Required:
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                  {stripeAccountStatus.requirements.currently_due.map((req, index) => (
                                    <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                                      {getRequirementMessage(req)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Show eventually due items as warnings */}
                            {!stripeAccountId.startsWith('acct_demo_') && stripeAccountStatus.requirements?.eventually_due && stripeAccountStatus.requirements.eventually_due.length > 0 && stripeAccountStatus.requirements.currently_due?.length === 0 && (
                              <div className="mt-3 bg-blue-50 dark:bg-blue-900/40 rounded-md p-3">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                  Coming Soon (will be required later):
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                  {stripeAccountStatus.requirements.eventually_due.slice(0, 3).map((req, index) => (
                                    <li key={index} className="text-sm text-blue-700 dark:text-blue-300">
                                      {getRequirementMessage(req)}
                                    </li>
                                  ))}
                                  {stripeAccountStatus.requirements.eventually_due.length > 3 && (
                                    <li className="text-sm text-blue-700 dark:text-blue-300">
                                      ...and {stripeAccountStatus.requirements.eventually_due.length - 3} more
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {!showInlineOnboarding && (
                              <div className="flex space-x-3 mt-3">
                                <button
                                  onClick={handleStripeOnboarding}
                                  disabled={isLoadingStripe}
                                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center"
                                >
                                  {isLoadingStripe ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                      Setting up...
                                    </>
                                  ) : (
                                    stripeAccountId.startsWith('acct_demo_') ? 'Complete Real Setup' : 'Complete Setup'
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Inline Stripe Embedded Onboarding */}
                            {showInlineOnboarding && inlineAccountId && (
                              <div className="mt-4 border dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white">Complete Your Payment Setup</h4>
                                  <button
                                    onClick={() => { setShowInlineOnboarding(false); setInlineAccountId(null); }}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                  Complete the form below to start receiving payments. Your information is securely handled by Stripe.
                                </p>
                                <StripeConnectOnboarding
                                  stripeAccountId={inlineAccountId}
                                  onExit={handleOnboardingComplete}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Earnings Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Earnings Overview</h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <BanknotesIcon className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${totalEarnings}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Earnings</p>
                  </div>

                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ${pendingPayouts}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Pending Payouts</p>
                  </div>

                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <CreditCardIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{completedBookingCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Completed Bookings</p>
                  </div>
                </div>

                {stripeAccountStatus.canReceivePayments ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-sm">✓</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200">Ready to Accept Payments</h4>
                        <p className="text-green-700 dark:text-green-300 text-sm">
                          Your account is fully set up. You'll receive payouts automatically after each booking.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CreditCardIcon className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>Complete payment setup to view earnings</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Analytics Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <ChartBarIcon className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                      Business Analytics
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Track your performance, earnings, and business insights
                    </p>
                  </div>
                  
                  {/* Period Selector */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    {(['week', 'month', 'quarter', 'year'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setAnalyticsPeriod(period)}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition capitalize ${
                          analyticsPeriod === period
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <EarningsChart period={analyticsPeriod} detailed />
              <BookingAnalytics period={analyticsPeriod} detailed />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ClientRetention period={analyticsPeriod} />
              <PerformanceMetrics period={analyticsPeriod} />
            </div>

            <div className="w-full">
              <TaxReports period={analyticsPeriod} />
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && user && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <UserSupportTickets userId={user.id} userType="CAREGIVER" />
          </div>
        )}
      </div>

      {/* Modals */}
      {/* TODO: Implement TimeSlotForm component
      {showAddSlot && (
        <TimeSlotForm
          onSave={addTimeSlot}
          onCancel={() => setShowAddSlot(false)}
        />
      )}

      {editingSlot && (
        <TimeSlotForm
          slot={editingSlot}
          onSave={updateTimeSlot}
          onCancel={() => setEditingSlot(null)}
        />
      )}
      */}

      {/* Stripe Loading & Success Modals */}
      <StripeRedirectLoading isOpen={showRedirectLoading} />

      <StripeOnboardingSuccess
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Booking Chat Modal */}
      {selectedChatBooking && user && (
        <BookingChatModal
          isOpen={showChatModal}
          onClose={() => {
            setShowChatModal(false);
            setSelectedChatBooking(null);
          }}
          bookingId={selectedChatBooking.id}
          otherPartyName={selectedChatBooking.parentName}
          otherPartyAvatar={selectedChatBooking.parentAvatar}
          otherPartyId={selectedChatBooking.parentId}
          currentUserId={user.id}
          currentUserName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.name || 'Caregiver'}
        />
      )}

      {/* Child Details Modal */}
      {selectedChildDetailsBooking && (
        <ChildDetailsModal
          isOpen={showChildDetailsModal}
          onClose={() => {
            setShowChildDetailsModal(false);
            setSelectedChildDetailsBooking(null);
          }}
          bookingId={selectedChildDetailsBooking.id}
          parentName={selectedChildDetailsBooking.parentName}
        />
      )}

      {/* Booking Extension Modal */}
      {showExtendModal && selectedExtendBooking && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Extend Booking
              </h3>
              <button
                onClick={() => {
                  setShowExtendModal(false);
                  setSelectedExtendBooking(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Current booking info */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  <strong>Original end time:</strong>{' '}
                  {new Date(selectedExtendBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone })}
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                  <strong>Rate:</strong> ${selectedExtendBooking.hourlyRate > 100 ? (selectedExtendBooking.hourlyRate / 100).toFixed(0) : selectedExtendBooking.hourlyRate}/hour
                </p>
              </div>

              {/* Extension duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extension Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setExtensionMinutes(mins)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                        extensionMinutes === mins
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost preview */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Parent will be charged:
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${((selectedExtendBooking.hourlyRate * extensionMinutes / 60)).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  New end time: {new Date(new Date(selectedExtendBooking.endTime).getTime() + extensionMinutes * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone })}
                </p>
              </div>

              {/* Optional reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="e.g., Parent running late"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Error message */}
              {extensionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{extensionError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedExtendBooking(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendBooking}
                  disabled={isExtending}
                  className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isExtending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ClockIcon className="h-4 w-4 mr-1" />
                      Extend & Charge
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Parent will be automatically charged using their saved payment method.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OAuth Profile Completion Modal for Caregivers */}
      {showOAuthCompletionModal && user && (
        <SignupModal
          isOpen={showOAuthCompletionModal}
          onClose={() => setShowOAuthCompletionModal(false)}
          mode="oauthCompletion"
          oauthUserType="caregiver"
          oauthUserData={{
            email: user.email || '',
            firstName: user.profile?.firstName || user.name?.split(' ')[0] || '',
            lastName: user.profile?.lastName || user.name?.split(' ').slice(1).join(' ') || '',
            image: user.profile?.avatar || undefined
          }}
          onOAuthComplete={async () => {
            // Clear OAuth cookies/localStorage
            document.cookie = 'oauthIntendedUserType=;path=/;max-age=0';
            localStorage.removeItem('oauthSignupUserType');
            localStorage.removeItem('oauthSignupTimestamp');
            // Refresh user data FIRST to update session with new userType
            await refreshUser();
            // Then update local state
            setProfileCompletedInSession(true);
            setShowOAuthCompletionModal(false);
          }}
        />
      )}
    </div>
  );
}

// Wrapper component that provides SocketProvider with user context
function CaregiverDashboardWithSocket() {
  const { user } = useAuth();

  return (
    <SocketProvider userId={user?.id} userType="caregiver">
      <CaregiverDashboardContent />
    </SocketProvider>
  );
}

export default function CaregiverDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <CaregiverDashboardWithSocket />
    </Suspense>
  );
}