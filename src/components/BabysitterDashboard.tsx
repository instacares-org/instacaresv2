'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DateTime } from 'luxon';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';
import BabysitterScheduleBuilder from './BabysitterScheduleBuilder';
import OrganizedMessagesContainer from './OrganizedMessagesContainer';
import UserSupportTickets from './UserSupportTickets';
import StripeOnboardingSuccess from './StripeOnboardingSuccess';
import DocumentsTab from './babysitter-dashboard/DocumentsTab';
import PaymentsTab from './babysitter-dashboard/PaymentsTab';
import AnalyticsTab from './babysitter-dashboard/AnalyticsTab';
import { addCSRFHeader } from '@/lib/csrf';

import { SocketProvider } from '@/context/SocketContext';
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
  UserGroupIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  PhoneIcon,
  CameraIcon,
  ArrowPathIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  BellIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';


interface BabysitterBooking {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  startTime: string;
  endTime: string;
  totalHours: number;
  subtotal: number;
  platformFee: number;
  totalAmount: number;
  paymentMethod: 'ONSITE' | 'PLATFORM';
  childrenCount: number;
  address?: string;
  city: string;
  parent: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
}

interface BabysitterProfile {
  id: string;
  bio: string;
  experienceYears: number;
  experienceSummary: string;
  hourlyRate: number;
  isAvailable: boolean;
  maxChildren: number;
  ageGroupsServed: string[] | null;
  totalBookings: number;
  averageRating: number | null;
  status: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  governmentIdFront?: string;
  policeCheck?: string;
  cprCertificate?: string;
  stripeConnectId?: string;
  stripeOnboarded: boolean;
  acceptsOnsitePayment: boolean;
}

interface AvailabilitySlot {
  id: string;
  recurrenceType: 'ONCE' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek?: number | null;
  day?: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  specificDate?: string | null;
  dayOfMonth?: number | null;
  repeatInterval?: number;
  anchorDate?: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: ClockIcon },
  CONFIRMED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: CheckCircleIcon },
  IN_PROGRESS: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: ArrowPathIcon },
  COMPLETED: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: CheckCircleIcon },
  CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: XCircleIcon },
  NO_SHOW: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: ExclamationTriangleIcon },
};

export default function BabysitterDashboard() {
  const { user, logout } = useAuth();
  const { timezone } = useUserTimezone();

  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'availability' | 'messages' | 'profile' | 'documents' | 'payments' | 'analytics' | 'support'>('overview');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [bookings, setBookings] = useState<BabysitterBooking[]>([]);
  const [profile, setProfile] = useState<BabysitterProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Stripe Connect state
  const [stripeAccountId, setStripeAccountId] = useState<string>('');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [showInlineOnboarding, setShowInlineOnboarding] = useState(false);
  const [inlineAccountId, setInlineAccountId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const searchParams = useSearchParams();

  // Phone verification state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'enter' | 'verify'>('enter');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // File input ref for avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch babysitter data
  const fetchData = useCallback(async () => {
    try {
      const [profileRes, bookingsRes, availRes] = await Promise.all([
        fetch('/api/babysitter/profile'),
        fetch('/api/babysitter/booking?role=babysitter'),
        fetch('/api/babysitter/availability'),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.babysitter);
        if (data.babysitter?.hourlyRate) {
          setHourlyRate(data.babysitter.hourlyRate);
          setTempRate(data.babysitter.hourlyRate);
        }
      }

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings(data.bookings || []);
      }

      if (availRes.ok) {
        const data = await availRes.json();
        setAvailability(data.slots || []);
      }
    } catch (error) {
      console.error('Failed to fetch babysitter data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize profile photo from user context
  useEffect(() => {
    if (user?.profile?.avatar) {
      setProfilePhoto(user.profile.avatar);
    }
  }, [user?.profile?.avatar]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, or WebP)');
      return;
    }
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
        headers: addCSRFHeader(),
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProfilePhoto(data.avatarUrl);
        alert('Profile picture updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Check URL params for Stripe setup return
  useEffect(() => {
    const setup = searchParams.get('setup');
    const tab = searchParams.get('tab');

    if (tab === 'payments') {
      setActiveTab('payments');
    }

    if (setup === 'success') {
      setActiveTab('payments');
      setShowSuccessModal(true);
      // Check Stripe status after returning from onboarding
      const savedId = localStorage.getItem('babysitter_stripe_account_id') || profile?.stripeConnectId;
      if (savedId) {
        checkStripeStatus(savedId);
      }
    } else if (setup === 'failed') {
      setActiveTab('payments');
    }
  }, [searchParams]);

  // Load saved Stripe account ID and check status when profile loads
  useEffect(() => {
    if (profile?.stripeConnectId) {
      setStripeAccountId(profile.stripeConnectId);
      localStorage.setItem('babysitter_stripe_account_id', profile.stripeConnectId);
      // If account exists but not marked as onboarded, check status with Stripe
      if (!profile.stripeOnboarded) {
        checkStripeStatus(profile.stripeConnectId);
      }
    } else {
      const savedId = localStorage.getItem('babysitter_stripe_account_id');
      if (savedId) {
        setStripeAccountId(savedId);
        checkStripeStatus(savedId);
      }
    }
  }, [profile?.stripeConnectId]);

  const startStripeOnboarding = async () => {
    setStripeLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/babysitter-onboard', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to start Stripe onboarding');
        return;
      }

      // Save account ID
      if (data.accountId) {
        setStripeAccountId(data.accountId);
        localStorage.setItem('babysitter_stripe_account_id', data.accountId);
      }

      // Demo mode: still redirect
      if (data.demo && data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
        return;
      }

      // Real mode: show inline embedded onboarding
      if (data.accountId) {
        setInlineAccountId(data.accountId);
        setShowInlineOnboarding(true);
      }
    } catch (error) {
      console.error('Stripe onboarding error:', error);
      alert('Failed to start Stripe onboarding. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowInlineOnboarding(false);
    setInlineAccountId(null);
    setShowSuccessModal(true);
    const savedId = localStorage.getItem('babysitter_stripe_account_id') || stripeAccountId;
    if (savedId) {
      checkStripeStatus(savedId);
    }
  };

  const checkStripeStatus = async (accountId: string) => {
    try {
      const response = await fetch('/api/stripe/connect/babysitter-status', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update profile state with new Stripe status
        if (data.detailsSubmitted || data.isDemo) {
          setProfile((prev: any) => prev ? {
            ...prev,
            stripeOnboarded: data.detailsSubmitted ?? false,
            stripeConnectId: accountId,
          } : prev);
        }
      }
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
    }
  };

  // Handle booking actions
  const handleBookingAction = async (bookingId: string, action: 'confirm' | 'cancel' | 'start' | 'complete') => {
    try {
      const res = await fetch(`/api/babysitter/booking/${bookingId}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update booking');
      }
    } catch (error) {
      console.error('Booking action error:', error);
      alert('Failed to update booking');
    }
  };

  // Handle rate edit
  const handleRateEdit = () => {
    setTempRate(hourlyRate);
    setIsEditingRate(true);
  };

  const cancelRateEdit = () => {
    setTempRate(hourlyRate);
    setIsEditingRate(false);
  };

  const saveRate = async () => {
    try {
      const res = await fetch('/api/babysitter/profile', {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ hourlyRate: tempRate }),
      });

      if (res.ok) {
        setHourlyRate(tempRate);
        setIsEditingRate(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update rate:', error);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload an image (JPEG, PNG, WebP) or PDF file');
      return;
    }

    setUploadingDoc(documentType);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);

      const res = await fetch('/api/babysitter/documents/upload', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: formData,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh profile to show updated document status
        fetchData();
        alert('Document uploaded successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Document upload error:', error);
      alert('Failed to upload document');
    } finally {
      setUploadingDoc(null);
      // Reset the file input
      e.target.value = '';
    }
  };

  // Phone verification handlers
  const openPhoneModal = () => {
    setPhoneNumber('');
    setVerificationCode('');
    setPhoneStep('enter');
    setPhoneError(null);
    setPhoneSuccess(null);
    setShowPhoneModal(true);
  };

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      setPhoneError('Please enter your phone number');
      return;
    }
    setPhoneSending(true);
    setPhoneError(null);
    try {
      const res = await fetch('/api/babysitter/verify-phone', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneStep('verify');
        setPhoneSuccess('Verification code sent! Check your phone.');
      } else {
        setPhoneError(data.error || 'Failed to send code');
      }
    } catch {
      setPhoneError('Failed to send verification code');
    } finally {
      setPhoneSending(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setPhoneError('Please enter the 6-digit code');
      return;
    }
    setPhoneSending(true);
    setPhoneError(null);
    try {
      const res = await fetch('/api/babysitter/verify-phone', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ code: verificationCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneSuccess('Phone number verified!');
        setShowPhoneModal(false);
        // Refresh profile to update phoneVerified status
        fetchData();
      } else {
        setPhoneError(data.error || 'Invalid code');
      }
    } catch {
      setPhoneError('Failed to verify code');
    } finally {
      setPhoneSending(false);
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === 'ALL') return true;
    return b.status === bookingFilter;
  });

  // Calculate stats
  const stats = {
    pendingBookings: bookings.filter(b => b.status === 'PENDING').length,
    upcomingBookings: bookings.filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length,
    completedBookings: bookings.filter(b => b.status === 'COMPLETED').length,
    totalEarnings: bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.subtotal, 0),
  };

  // Format time for display
  const formatTime = (isoString: string) => {
    return DateTime.fromISO(isoString).setZone(timezone).toFormat('h:mm a');
  };

  const formatDate = (isoString: string) => {
    return DateTime.fromISO(isoString).setZone(timezone).toFormat('EEE, MMM d');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Matching caregiver dashboard */}
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
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Babysitter Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition"
                title="Refresh"
              >
                <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center space-x-3">
                {user && (
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center overflow-hidden">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-green-600 dark:text-green-300 font-medium text-sm">
                        {user.profile?.firstName?.charAt(0) || 'B'}
                      </span>
                    )}
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
        {/* Profile Overview - Matching caregiver dashboard */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-green-100 dark:bg-green-900">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-green-600 dark:text-green-300">
                    {user?.profile?.firstName?.charAt(0) || 'B'}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'Babysitter'}
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
                  <span className="text-gray-900 dark:text-white font-medium">
                    {profile?.averageRating?.toFixed(1) || 'No rating'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                    ({profile?.totalBookings || 0} bookings)
                  </span>
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

        {/* Verification Alert */}
        {profile?.status !== 'APPROVED' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Profile Verification Required</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Your profile is pending verification. Please complete the following to start accepting bookings:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                  {!profile?.governmentIdFront && <li>• Upload government-issued ID</li>}
                  {!profile?.policeCheck && <li>• Upload vulnerable sector check</li>}
                  {!profile?.phoneVerified && <li>• Verify your phone number</li>}
                  {!profile?.bio && <li>• Complete your profile bio</li>}
                </ul>
                <button
                  onClick={() => setActiveTab('documents')}
                  className="mt-3 text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:underline"
                >
                  Complete verification →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation - Matching caregiver dashboard style */}
        <div className="flex space-x-1 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'overview'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline-block mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              activeTab === 'bookings'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarDaysIcon className="h-5 w-5 inline-block mr-2" />
            Bookings
            {stats.pendingBookings > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {stats.pendingBookings > 9 ? '9+' : stats.pendingBookings}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'availability'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ClockIcon className="h-5 w-5 inline-block mr-2" />
            Availability
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'profile'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UserGroupIcon className="h-5 w-5 inline-block mr-2" />
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'documents'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheckIcon className="h-5 w-5 inline-block mr-2" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('messages')}
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
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'payments'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CreditCardIcon className="h-5 w-5 inline-block mr-2" />
            Payments
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
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
            onClick={() => setActiveTab('support')}
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingBookings}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.upcomingBookings}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <CalendarDaysIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedBookings}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">${stats.totalEarnings.toFixed(0)}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <BanknotesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Requests */}
            {stats.pendingBookings > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Pending Requests ({stats.pendingBookings})
                </h3>
                <div className="space-y-4">
                  {bookings
                    .filter(b => b.status === 'PENDING')
                    .slice(0, 3)
                    .map((booking) => (
                      <div key={booking.id} className="border dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                              {booking.parent.avatar ? (
                                <img src={booking.parent.avatar} alt="" className="w-10 h-10 rounded-full" />
                              ) : (
                                <span className="text-green-600 dark:text-green-300 font-medium">
                                  {booking.parent.firstName?.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {booking.parent.firstName} {booking.parent.lastName}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(booking.startTime)} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {booking.childrenCount} child{booking.childrenCount !== 1 ? 'ren' : ''} • {booking.city}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ${booking.subtotal.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {booking.totalHours}h @ ${(booking.subtotal / booking.totalHours).toFixed(0)}/hr
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <button
                            onClick={() => handleBookingAction(booking.id, 'confirm')}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleBookingAction(booking.id, 'cancel')}
                            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
                {stats.pendingBookings > 3 && (
                  <button
                    onClick={() => { setActiveTab('bookings'); setBookingFilter('PENDING'); }}
                    className="mt-4 text-green-600 dark:text-green-400 font-medium hover:underline"
                  >
                    View all pending requests →
                  </button>
                )}
              </div>
            )}

            {/* Upcoming Bookings */}
            {stats.upcomingBookings > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Upcoming Bookings ({stats.upcomingBookings})
                </h3>
                <div className="space-y-4">
                  {bookings
                    .filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status))
                    .slice(0, 3)
                    .map((booking) => {
                      const StatusIcon = STATUS_COLORS[booking.status]?.icon || CheckCircleIcon;
                      return (
                        <div key={booking.id} className="border dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                {booking.parent.avatar ? (
                                  <img src={booking.parent.avatar} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                  <span className="text-green-600 dark:text-green-300 font-medium">
                                    {booking.parent.firstName?.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {booking.parent.firstName} {booking.parent.lastName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDate(booking.startTime)} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                                </div>
                                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-1 ${STATUS_COLORS[booking.status]?.bg} ${STATUS_COLORS[booking.status]?.text}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {booking.status.replace('_', ' ')}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                ${booking.subtotal.toFixed(2)}
                              </div>
                              {booking.status === 'CONFIRMED' && (
                                <button
                                  onClick={() => handleBookingAction(booking.id, 'start')}
                                  className="mt-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  Start Session
                                </button>
                              )}
                              {booking.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={() => handleBookingAction(booking.id, 'complete')}
                                  className="mt-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {stats.pendingBookings === 0 && stats.upcomingBookings === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                <CalendarDaysIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Bookings</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  When parents book your services, they&apos;ll appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Bookings</h3>
              <div className="flex space-x-2">
                {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBookingFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      bookingFilter === filter
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No bookings found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => {
                  const StatusIcon = STATUS_COLORS[booking.status]?.icon || CheckCircleIcon;
                  return (
                    <div key={booking.id} className="border dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            {booking.parent.avatar ? (
                              <img src={booking.parent.avatar} alt="" className="w-12 h-12 rounded-full" />
                            ) : (
                              <span className="text-green-600 dark:text-green-300 font-medium text-lg">
                                {booking.parent.firstName?.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {booking.parent.firstName} {booking.parent.lastName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(booking.startTime)} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {booking.childrenCount} child{booking.childrenCount !== 1 ? 'ren' : ''} • {booking.city}
                            </div>
                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-2 ${STATUS_COLORS[booking.status]?.bg} ${STATUS_COLORS[booking.status]?.text}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {booking.status.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white text-lg">
                            ${booking.subtotal.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {booking.totalHours}h @ ${(booking.subtotal / booking.totalHours).toFixed(0)}/hr
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {booking.paymentMethod === 'ONSITE' ? 'On-site payment' : 'Platform payment'}
                          </div>

                          {booking.status === 'PENDING' && (
                            <div className="flex space-x-2 mt-3">
                              <button
                                onClick={() => handleBookingAction(booking.id, 'confirm')}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleBookingAction(booking.id, 'cancel')}
                                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleBookingAction(booking.id, 'start')}
                              className="mt-3 px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                            >
                              Start Session
                            </button>
                          )}
                          {booking.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleBookingAction(booking.id, 'complete')}
                              className="mt-3 px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                            >
                              Complete Session
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <BabysitterScheduleBuilder
              onScheduleUpdate={(slots) => setAvailability(slots)}
            />
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Settings</h3>

            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="flex items-center space-x-6 pb-6 border-b dark:border-gray-700">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <span className="text-3xl font-semibold text-green-600 dark:text-green-300">
                        {user?.profile?.firstName?.charAt(0) || 'B'}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 h-8 w-8 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center shadow-lg disabled:opacity-50 transition"
                  >
                    {uploadingAvatar ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <CameraIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Profile Photo</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {uploadingAvatar ? 'Uploading...' : 'Click the camera icon to upload or change your photo'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPEG, PNG, or WebP. Max 5MB.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                <textarea
                  rows={4}
                  defaultValue={profile?.bio || ''}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                  placeholder="Tell parents about yourself, your experience, and why you love babysitting..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Years of Experience</label>
                  <input
                    type="number"
                    defaultValue={profile?.experienceYears || 0}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Children</label>
                  <input
                    type="number"
                    defaultValue={profile?.maxChildren || 3}
                    min="1"
                    max="6"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Experience Summary</label>
                <textarea
                  rows={3}
                  defaultValue={profile?.experienceSummary || ''}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                  placeholder="Briefly describe your childcare experience..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Age Groups You Serve</label>
                <div className="flex flex-wrap gap-2">
                  {['infant', 'toddler', 'preschool', 'school-age', 'preteen'].map((age) => (
                    <label key={age} className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        defaultChecked={profile?.ageGroupsServed?.includes(age)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">{age}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    defaultChecked={profile?.isAvailable}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Available for bookings</span>
                </div>
                <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <DocumentsTab
            profile={profile}
            uploadingDoc={uploadingDoc}
            onDocumentUpload={handleDocumentUpload}
            onVerifyPhone={openPhoneModal}
          />
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && user && (
          <SocketProvider>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <OrganizedMessagesContainer
                userId={user.id}
                userType="caregiver"
                onMessageRead={setUnreadMessageCount}
              />
            </div>
          </SocketProvider>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <PaymentsTab
            profile={profile}
            bookings={bookings}
            totalEarnings={stats.totalEarnings}
            stripeLoading={stripeLoading}
            showInlineOnboarding={showInlineOnboarding}
            inlineAccountId={inlineAccountId}
            onStartStripeOnboarding={startStripeOnboarding}
            onCancelInlineOnboarding={() => { setShowInlineOnboarding(false); setInlineAccountId(null); }}
            onOnboardingComplete={handleOnboardingComplete}
            onUpdateProfile={(data) => setProfile((prev: any) => prev ? { ...prev, ...data } : prev)}
            formatDate={formatDate}
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            completedBookings={stats.completedBookings}
            totalEarnings={stats.totalEarnings}
            averageRating={profile?.averageRating ?? null}
            totalHoursWorked={bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + b.totalHours, 0)}
          />
        )}

        {/* Support Tab */}
        {activeTab === 'support' && user && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <UserSupportTickets userType="CAREGIVER" />
          </div>
        )}
      </div>

      {/* Stripe Onboarding Success Modal */}
      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowPhoneModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full mx-auto shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Phone Verification
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {phoneStep === 'enter'
                  ? 'Enter your phone number to receive a verification code via SMS.'
                  : 'Enter the 6-digit code sent to your phone.'}
              </p>

              {phoneError && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  {phoneError}
                </div>
              )}
              {phoneSuccess && phoneStep === 'verify' && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
                  {phoneSuccess}
                </div>
              )}

              {phoneStep === 'enter' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="(416) 555-0123"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Canadian/US numbers only. Standard SMS rates may apply.</p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowPhoneModal(false)}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendVerificationCode}
                      disabled={phoneSending}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {phoneSending ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                          Sending...
                        </>
                      ) : 'Send Code'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500 text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => { setPhoneStep('enter'); setPhoneError(null); setPhoneSuccess(null); }}
                      className="text-sm text-green-600 dark:text-green-400 hover:underline"
                    >
                      Resend code
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPhoneModal(false)}
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={verifyPhoneCode}
                        disabled={phoneSending || verificationCode.length !== 6}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {phoneSending ? (
                          <>
                            <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : 'Verify'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <StripeOnboardingSuccess
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
}
