"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import AddressAutocompleteFree from '@/components/AddressAutocompleteFree';
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
  ChartBarIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import Chat from "../../components/Chat";
import ChatWebSocket from "../../components/ChatWebSocket";
import OrganizedMessagesContainer from "../../components/OrganizedMessagesContainer";
import NotificationSettings from "../../components/NotificationSettings";
import NotificationInitializer from "../../components/NotificationInitializer";
import { useNotificationStorage } from "../../hooks/useNotificationStorage";
import { useUnreadMessageCount } from "../../hooks/useUnreadMessageCount";
import PhotoUpload from "../../components/PhotoUpload";
import CaregiverProfileImage from "../../components/CaregiverProfileImage";
import ThemeToggle from "../../components/ThemeToggle";
import EarningsChart from "../../components/analytics/EarningsChart";
import BookingAnalytics from "../../components/analytics/BookingAnalytics";
import ClientRetention from "../../components/analytics/ClientRetention";
import PerformanceMetrics from "../../components/analytics/PerformanceMetrics";
import TaxReports from "../../components/analytics/TaxReports";
import IntuitiveScheduleManager from "../../components/IntuitiveScheduleManager";
import SimpleScheduleBuilder from "../../components/SimpleScheduleBuilder";
import { useCaregiverProfile } from "../../hooks/useCaregiverProfile";

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

interface Booking {
  id: string;
  parentId: string;
  parentName: string;
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
}

function CaregiverDashboardContent() {
  const { user, loading: authLoading, isAuthenticated, isCaregiver, logout, refreshUser } = useAuth();
  const { caregiverId, loading: caregiverLoading } = useCaregiverProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'bookings' | 'messages' | 'preferences' | 'photos' | 'payments' | 'analytics'>('profile');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  // Use real notification storage for caregivers too
  const { 
    notifications, 
    unreadCount: realUnreadCount, 
    markAsRead,
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

  // Calculate notification badge counts
  const unreadBookingCount = notifications.filter(n => 
    !n.isRead && (n.type === 'booking_request' || n.type === 'booking_confirmed' || n.type === 'booking_cancelled')
  ).length;
  
  // Use real unread message count from chat rooms
  const unreadMessageCount = realUnreadMessageCount;

  // Badge counts calculated

  // Mark message notifications as read when messages tab is viewed
  const handleTabChange = (tab: 'profile' | 'schedule' | 'bookings' | 'messages' | 'preferences' | 'photos' | 'payments' | 'analytics') => {
    setActiveTab(tab);
    
    if (tab === 'messages') {
      // Mark all unread message notifications as read
      const unreadMessageNotifications = notifications.filter(n => 
        !n.isRead && n.type === 'new_message'
      );
      
      unreadMessageNotifications.forEach(notification => {
        markAsRead(notification.id);
      });

      // Refresh real message count when opening messages tab
      refreshMessageCount();
    }
  };
  const [hourlyRate, setHourlyRate] = useState(25);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(25);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profile?.avatar || null);
  
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
  const [stripeAccountStatus, setStripeAccountStatus] = useState({
    canReceivePayments: false,
    chargesEnabled: false,
    detailsSubmitted: false,
    payoutsEnabled: false,
  });
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);

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

  // Fetch caregiver bookings
  const fetchBookings = async () => {
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
  };

  // Fetch caregiver photos
  const fetchPhotos = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingPhotos(true);
      
      const response = await fetch('/api/caregivers/photos');
      
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      
      const result = await response.json();
      
      if (result.photos) {
        setPhotos(result.photos);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Update booking status
  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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
  };

  // Redirect if not authenticated or not a caregiver
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !isCaregiver) {
        router.push('/login/caregiver');
      } else {
        // Fetch bookings and photos when user is authenticated
        fetchBookings();
        fetchPhotos();
      }
    }
  }, [authLoading, isAuthenticated, isCaregiver, router, user]);

  // Add initial notifications for new caregiver users
  useEffect(() => {
    if (user && notifications.length === 0) {
      // Use a flag to prevent multiple executions
      const notificationInitialized = localStorage.getItem(`notifications-initialized-${user.id}`);
      
      if (!notificationInitialized) {
        // Add welcome notification for new caregivers
        addSystemNotification('Welcome to Instacares!', 'Thank you for joining as a caregiver. Complete your profile to start receiving booking requests.');
        
        // Add sample notifications to show the system working
        setTimeout(() => {
          addBookingNotification('New Booking Request', 'A parent has requested your services for this weekend.', 'booking-caregiver-1', 'request');
        }, 1000);
        
        setTimeout(() => {
          addMessageNotification('Sarah Johnson', 'Hi! I would like to discuss my booking request with you.', 'caregiver-room-1');
        }, 2000);

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
  const updateStripeAccountId = (accountId: string) => {
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
  };

  // Save Stripe status to localStorage whenever it changes
  const updateStripeAccountStatus = (status: typeof stripeAccountStatus) => {
    setStripeAccountStatus(status);
    try {
      localStorage.setItem('stripeAccountStatus', JSON.stringify(status));
    } catch (error) {
      console.error('Failed to save Stripe status to localStorage:', error);
    }
  };

  // Clear all Stripe data (for testing)
  const clearStripeData = () => {
    updateStripeAccountId('');
    updateStripeAccountStatus({
      canReceivePayments: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
    });
    localStorage.removeItem('stripeAccountId');
    localStorage.removeItem('stripeAccountStatus');
  };
  
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

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const addTimeSlot = (slot: Omit<TimeSlot, 'id'>) => {
    const newSlot = {
      ...slot,
      id: Date.now().toString()
    };
    setTimeSlots(prev => [...prev, newSlot]);
    setShowAddSlot(false);
  };

  const updateTimeSlot = (updatedSlot: TimeSlot) => {
    setTimeSlots(prev => prev.map(slot => 
      slot.id === updatedSlot.id ? updatedSlot : slot
    ));
    setEditingSlot(null);
  };

  const deleteTimeSlot = (id: string) => {
    setTimeSlots(prev => prev.filter(slot => slot.id !== id));
  };

  const handleRateEdit = () => {
    setTempRate(hourlyRate);
    setIsEditingRate(true);
  };

  const saveRate = () => {
    setHourlyRate(tempRate);
    setIsEditingRate(false);
  };

  const cancelRateEdit = () => {
    setTempRate(hourlyRate);
    setIsEditingRate(false);
  };

  const toggleAgeGroup = (id: string) => {
    setAgeGroups(prev => prev.map(group => 
      group.id === id ? { ...group, selected: !group.selected } : group
    ));
  };

  const toggleSpecialty = (id: string) => {
    setSpecialties(prev => prev.map(specialty => 
      specialty.id === id ? { ...specialty, selected: !specialty.selected } : specialty
    ));
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
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    setUploadingAvatar(true);
    
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfilePhoto(data.avatarUrl);
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
  };

  // Address saving function
  const handleSaveAddress = async () => {
    setSavingAddress(true);
    try {
      const response = await fetch('/api/profile/update-address', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData),
        credentials: 'include',
      });

      if (response.ok) {
        setIsEditingAddress(false);
        // Refresh user context to get updated address data
        await refreshUser();
        console.log('Address updated, refreshed user profile:', user?.profile);
        alert('Address updated successfully!');
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
  };

  const handleCancelAddressEdit = () => {
    setAddressData({
      streetAddress: user?.profile?.streetAddress || '',
      apartment: user?.profile?.apartment || '',
      city: user?.profile?.city || '',
      state: user?.profile?.province || user?.profile?.state || '',
      zipCode: user?.profile?.postalCode || user?.profile?.zipCode || '',
      country: user?.profile?.country || 'US'
    });
    setIsEditingAddress(false);
  };

  // Stripe Connect functions
  const handleStripeOnboarding = async () => {
    if (!user) {
      alert('User information not available. Please try refreshing the page.');
      return;
    }

    // Check if we're in demo mode
    const isDemoMode = process.env.NEXT_PUBLIC_STRIPE_CONNECT_ENABLED !== 'true';
    
    if (isDemoMode) {
      // Show demo mode explanation
      const continueDemo = confirm(
        'Demo Mode Active\n\n' +
        'You are currently in demo mode. Clicking "OK" will create another demo account for testing purposes.\n\n' +
        'To enable real Stripe Connect payments:\n' +
        '1. Contact your administrator\n' +
        '2. Set STRIPE_CONNECT_ENABLED=true in environment\n' +
        '3. Complete Stripe Connect setup in dashboard\n\n' +
        'Continue with demo setup?'
      );
      
      if (!continueDemo) {
        return;
      }
    }

    setIsLoadingStripe(true);
    try {
      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email || 'user@example.com',
          caregiverName: `${user.profile?.firstName || 'Unknown'} ${user.profile?.lastName || 'User'}`.trim(),
          phone: user.profile?.phone || '',
          address: {
            line1: user.profile?.streetAddress || '',
            city: user.profile?.city || '',
            state: user.profile?.state || '',
            postal_code: user.profile?.zipCode || '',
          },
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.onboardingUrl) {
        updateStripeAccountId(data.accountId);
        
        if (data.demo) {
          // Demo mode - just redirect to dashboard with success
          console.log('Demo account created:', data.accountId);
          window.location.href = data.onboardingUrl;
        } else {
          // Real mode - redirect to Stripe Connect onboarding
          console.log('Redirecting to Stripe Connect onboarding...');
          window.location.href = data.onboardingUrl;
        }
      } else {
        console.error('Stripe onboarding error:', data);
        alert(`Setup Failed\n\n${data.error || 'Unknown error occurred'}\n${data.details ? '\nDetails: ' + data.details : ''}`);
      }
    } catch (error) {
      console.error('Stripe onboarding network error:', error);
      alert('Network Error\n\nCould not connect to payment setup service. Please check your internet connection and try again.');
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const checkStripeAccountStatus = async (accountId: string) => {
    try {
      const response = await fetch('/api/stripe/connect/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();
      
      if (data.accountId) {
        updateStripeAccountStatus({
          canReceivePayments: data.canReceivePayments,
          chargesEnabled: data.chargesEnabled,
          detailsSubmitted: data.detailsSubmitted,
          payoutsEnabled: data.payoutsEnabled,
        });
      }
    } catch (error) {
      console.error('Failed to check Stripe account status:', error);
    }
  };

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
                    {user?.profile?.city && user?.profile?.province 
                      ? `${user.profile.city}, ${user.profile.province}` 
                      : 'Location not provided'}
                  </span>
                </div>
                <div className="flex items-center mt-1">
                  <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                  <span className="text-gray-900 dark:text-white font-medium">4.9</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">(24 reviews)</span>
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
            {unreadBookingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {unreadBookingCount > 9 ? '9+' : unreadBookingCount}
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
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Bookings</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {bookings.length} total booking{bookings.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={fetchBookings}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"
                  >
                    Refresh
                  </button>
                </div>
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
              ) : bookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No bookings yet</p>
                  <p className="text-sm">Your confirmed bookings will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Booking with {booking.parentName}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700' :
                              booking.status === 'CONFIRMED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700' :
                              booking.status === 'IN_PROGRESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700' :
                              booking.status === 'COMPLETED' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600' :
                              'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
                            }`}>
                              {booking.status.toLowerCase()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300 mb-3">
                            <div className="flex items-center">
                              <CalendarDaysIcon className="h-4 w-4 mr-2" />
                              <span>
                                {new Date(booking.startTime).toLocaleDateString()} • {' '}
                                {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                                {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            <div className="flex items-center">
                              <UserGroupIcon className="h-4 w-4 mr-2" />
                              <span>{booking.childrenCount} child{booking.childrenCount !== 1 ? 'ren' : ''}</span>
                            </div>
                            
                            <div className="flex items-center">
                              <MapPinIcon className="h-4 w-4 mr-2" />
                              <span className="truncate">{booking.address}</span>
                            </div>
                            
                            <div className="flex items-center">
                              <BanknotesIcon className="h-4 w-4 mr-2" />
                              <span className="font-medium text-green-600">
                                ${(booking.totalAmount / 100).toFixed(2)} ({booking.totalHours}h × ${booking.hourlyRate}/hr)
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
                          <div className="ml-4 flex space-x-2">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'CANCELLED')}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        
                        {booking.status === 'CONFIRMED' && new Date(booking.startTime) <= new Date() && (
                          <div className="ml-4">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'IN_PROGRESS')}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                            >
                              Start
                            </button>
                          </div>
                        )}
                        
                        {booking.status === 'IN_PROGRESS' && (
                          <div className="ml-4">
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
            />
          </div>
        )}

        {/* Care Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
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
                    <AddressAutocompleteFree
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
                  <p>Unable to load caregiver profile. Please try refreshing the page.</p>
                </div>
              )}
            </div>
            
            {/* Notification Settings */}
            <div className="border-t border-gray-200 dark:border-gray-700">
              <NotificationSettings />
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
                <p className="text-gray-600 text-sm mt-1">
                  Connect your bank account to receive payments from bookings
                </p>
              </div>

              <div className="p-6">
                {!stripeAccountId ? (
                  <div className="text-center py-8">
                    <CreditCardIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Connect Your Bank Account
                    </h4>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Set up secure payments through Stripe to receive earnings from your bookings. 
                      The setup takes just a few minutes.
                    </p>
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
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Account Status</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Stripe Account ID: {stripeAccountId}</p>
                        {stripeAccountId.startsWith('acct_demo_') ? (
                          <p className="text-xs text-yellow-600 mt-1">⚠️ Demo account - Complete setup to receive real payments</p>
                        ) : (
                          <p className="text-xs text-green-600 mt-1">✓ Connection saved - persists after refresh</p>
                        )}
                      </div>
                      <button
                        onClick={() => checkStripeAccountStatus(stripeAccountId)}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Refresh Status
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.detailsSubmitted
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
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
                            <p className="text-sm font-medium">Details</p>
                            <p className="text-xs text-gray-600">
                              {stripeAccountStatus.detailsSubmitted ? 'Complete' : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.chargesEnabled
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
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
                            <p className="text-sm font-medium">Payments</p>
                            <p className="text-xs text-gray-600">
                              {stripeAccountStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.payoutsEnabled
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
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
                            <p className="text-sm font-medium">Payouts</p>
                            <p className="text-xs text-gray-600">
                              {stripeAccountStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border-2 ${
                        stripeAccountStatus.canReceivePayments
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
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
                            <p className="text-sm font-medium">Status</p>
                            <p className="text-xs text-gray-600">
                              {stripeAccountStatus.canReceivePayments ? 'Ready' : 'Setup Required'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!stripeAccountStatus.canReceivePayments && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                          <div>
                            <h4 className="font-medium text-yellow-800">
                              {stripeAccountId.startsWith('acct_demo_') ? 'Demo Account - Real Setup Required' : 'Setup Required'}
                            </h4>
                            <p className="text-yellow-700 text-sm mt-1">
                              {stripeAccountId.startsWith('acct_demo_') 
                                ? 'You are currently using a demo account. To receive real payments from bookings, you need to complete the Stripe Connect setup with your bank account details.'
                                : 'Complete your Stripe setup to start receiving payments. You may need to provide additional information or verify your identity.'}
                            </p>
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
                              {/* Debug button for testing - remove in production */}
                              <button
                                onClick={clearStripeData}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition"
                                title="Clear saved data (for testing)"
                              >
                                Reset
                              </button>
                            </div>
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
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">$1,247</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Earnings</p>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">$340</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Pending Payouts</p>
                  </div>

                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <CreditCardIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">18</p>
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
    </div>
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
      <CaregiverDashboardContent />
    </Suspense>
  );
}