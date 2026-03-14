"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { XMarkIcon, CalendarDaysIcon, ClockIcon, UserGroupIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Caregiver } from './CaregiverCard';
import BookingForm from './BookingForm';
import CaregiverProfileImage from './CaregiverProfileImage';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailability, useLiveAvailability } from '@/hooks/useAvailability';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { useStripeAppearance } from '@/hooks/useStripeAppearance';
import { DateTime } from 'luxon';
import { useRouter } from 'next/navigation';
import { addCSRFHeaders, useCSRFToken } from './security/CSRFTokenProvider';
import { formatCAD } from '@/lib/currency';

interface BookingModalProps {
  caregiver: Caregiver;
  isOpen: boolean;
  onClose: () => void;
}

// Lazy-load Stripe.js only when needed (not at module level)
let stripePromise: Promise<Stripe | null> | null = null;
const getStripePromise = () => {
  if (!stripePromise) {
    stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_')
      ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
      : Promise.resolve(null);
  }
  return stripePromise;
};

interface ChildProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  allergies?: string | Array<{ id?: string; name: string; reaction?: string; severity?: string; treatment?: string }>;
  medications?: string | Array<{ id?: string; name: string; dosage?: string; frequency?: string; instructions?: string }>;
  medicalConditions?: string | Array<{ id?: string; name: string; severity?: string; notes?: string }>;
  emergencyMedicalInfo?: string;
  bloodType?: string;
  emergencyContacts?: any;
  dietaryRestrictions?: string;
  specialInstructions?: string;
  pickupInstructions?: string;
  photoUrl?: string;
  createdAt: string;
}

// TIMEZONE FIX: Convert UTC database times to user's local timezone for display
// Uses Luxon + user's timezone from their profile (via useUserTimezone hook)
const formatTimeForDisplay = (timeString: string, tz: string) => {
  try {
    // Ensure the string is treated as UTC
    const utcStr = timeString.endsWith('Z') || timeString.includes('+')
      ? timeString
      : timeString.replace(/\.\d{3}$/, '') + 'Z';
    const dt = DateTime.fromISO(utcStr, { zone: 'UTC' }).setZone(tz);
    if (!dt.isValid) return 'Invalid time';
    return dt.toFormat('h:mm a');
  } catch {
    return 'Invalid time';
  }
};

// Helper: Convert a UTC time string to local Luxon DateTime
const toLocalDateTime = (timeString: string, tz: string) => {
  const utcStr = timeString.endsWith('Z') || timeString.includes('+')
    ? timeString
    : timeString.replace(/\.\d{3}$/, '') + 'Z';
  return DateTime.fromISO(utcStr, { zone: 'UTC' }).setZone(tz);
};

// Helper: Get today's date string in user's timezone (YYYY-MM-DD)
const getTodayInTimezone = (tz: string) => {
  return DateTime.now().setZone(tz).toFormat('yyyy-MM-dd');
};

export default function BookingModal({ caregiver, isOpen, onClose }: BookingModalProps) {
  const { user, isAuthenticated, isParent } = useAuth();
  const { reserveSpots, cancelReservation } = useAvailability();
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<number>(0.10); // Default 10%
  const { timezone: userTimezone } = useUserTimezone();
  const stripeAppearance = useStripeAppearance();
  const [bookingDetails, setBookingDetails] = useState({
    isMultiDay: false,
    startDate: '',
    endDate: '',
    date: '', // Legacy single day support
    startTime: '09:00',
    endTime: '17:00',
    selectedChildIds: [] as string[],
    specialRequests: '',
    isSplitPayment: false,
    splitParties: [] as Array<{ name: string; email: string; percentage: number }>,
  });
  const [totalAmount, setTotalAmount] = useState(0);
  const [step, setStep] = useState<'details' | 'confirmation' | 'payment'>('details');
  const [error, setError] = useState<string | null>(null);
  const [hasChildren, setHasChildren] = useState<boolean | null>(null); // null = loading, false = no children, true = has children
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [showSpecialRequests, setShowSpecialRequests] = useState(false);

  // Live availability state
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [currentReservation, setCurrentReservation] = useState<any>(null);
  const [reservationTimer, setReservationTimer] = useState<number>(0);
  
  // Validate that we have the required caregiver record ID
  const caregiverIdForAvailability = (() => {
    if (!caregiver.caregiverId) {
      console.error('❌ CRITICAL ERROR: Missing caregiverId for', caregiver.name, {
        hasId: !!caregiver.id,
        hasCaregiverId: !!caregiver.caregiverId,
        caregiverObject: caregiver
      });
      throw new Error(`Missing caregiverId for caregiver ${caregiver.name}. Cannot query availability.`);
    }
    console.log('✅ Using correct caregiverId for availability:', caregiver.caregiverId);
    return caregiver.caregiverId;
  })();

  // Get all available dates for this caregiver (not just selected date)
  const [allAvailability, setAllAvailability] = useState<any[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  
  // Live availability for selected date and caregiver
  const { 
    availability, 
    loading: selectedDateLoading, 
    error: selectedDateError, 
    refresh: refreshAvailability 
  } = useLiveAvailability(
    caregiverIdForAvailability,
    bookingDetails.date || getTodayInTimezone(userTimezone),
    15000 // Refresh every 15 seconds
  );

  // Debug availability data
  console.log('🔍 Availability Data:', {
    loading: availabilityLoading,
    error: availabilityError,
    availability: availability,
    totalSpots: availability?.totalSpotsAvailable,
    slotsCount: availability?.slots?.length,
    queryingDate: bookingDetails.date || getTodayInTimezone(userTimezone)
  });

  const calculateHours = () => {
    if (!bookingDetails.startTime || !bookingDetails.endTime) return 0;
    const start = new Date(`2000-01-01T${bookingDetails.startTime}:00`);
    const end = new Date(`2000-01-01T${bookingDetails.endTime}:00`);
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  };

  const calculateDays = () => {
    if (bookingDetails.isMultiDay && bookingDetails.startDate && bookingDetails.endDate) {
      const start = new Date(bookingDetails.startDate);
      const end = new Date(bookingDetails.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    }
    return 1; // Single day
  };

  const calculateTotal = () => {
    const hours = calculateHours();
    const days = calculateDays();
    const selectedChildCount = bookingDetails.selectedChildIds.length;
    
    // Base price calculation - can be enhanced later for age-based pricing
    const basePrice = hours * days * caregiver.hourlyRate;
    
    // Add small premium for multiple children (optional)
    const multiChildMultiplier = selectedChildCount > 1 ? 1 + ((selectedChildCount - 1) * 0.1) : 1;
    
    // Multi-day discount (5% off for 3+ days, 10% off for 5+ days)
    let multiDayDiscount = 1;
    if (days >= 5) {
      multiDayDiscount = 0.9; // 10% off
    } else if (days >= 3) {
      multiDayDiscount = 0.95; // 5% off
    }
    
    return Math.round(basePrice * multiChildMultiplier * multiDayDiscount * 100); // Amount in cents
  };

  useEffect(() => {
    setTotalAmount(calculateTotal());
  }, [bookingDetails.startTime, bookingDetails.endTime, bookingDetails.startDate, bookingDetails.endDate, bookingDetails.isMultiDay, bookingDetails.selectedChildIds, caregiver.hourlyRate]);

  // Fetch platform commission rate on mount
  useEffect(() => {
    const fetchCommissionRate = async () => {
      try {
        const response = await fetch('/api/platform/commission-rate');
        if (response.ok) {
          const data = await response.json();
          if (data.commissionRate) {
            setCommissionRate(data.commissionRate);
          }
        }
      } catch (error) {
        console.error('Error fetching commission rate:', error);
        // Keep default rate on error
      }
    };
    fetchCommissionRate();
  }, []);

  // Check if user has children when modal opens
  useEffect(() => {
    console.log('📅 Modal Effect:', { isOpen, user: !!user, isParent });
    if (isOpen && user && isParent) {
      console.log('📅 Calling fetchAllAvailability and checkChildProfiles');
      checkChildProfiles();
      fetchAllAvailability();
    }
  }, [isOpen, user, isParent]);

  // Fetch all available dates for this caregiver
  const fetchAllAvailability = async () => {
    if (!caregiverIdForAvailability) {
      console.error('❌ Cannot fetch availability: missing caregiverId');
      setAvailabilityError('Missing caregiver ID');
      setAvailabilityLoading(false);
      return;
    }

    try {
      console.log('🚀 Starting fetchAllAvailability...');
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      
      // Get next 60 days of availability (use local date, not UTC, so evening slots work after 7PM EST)
      const nowLocal = new Date();
      const startDate = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
      const endDateObj = new Date(nowLocal);
      endDateObj.setDate(endDateObj.getDate() + 60);
      const endDateStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      
      console.log('🔍 Fetching all availability for caregiver:', caregiverIdForAvailability);
      console.log('📅 Date range:', { startDate, endDate: endDateStr });
      
      const url = `/api/availability/slots?caregiverId=${caregiverIdForAvailability}&startDate=${startDate}&endDate=${endDateStr}&userTimezone=${encodeURIComponent(userTimezone)}`;
      console.log('🌐 API URL:', url);
      
      const response = await fetch(url);
      console.log('📡 Response status:', response.status);
      
      const data = await response.json();
      console.log('📊 Response data:', data);
      
      if (data.success) {
        const slots = data.data || [];
        setAllAvailability(slots);
        console.log('✅ All availability loaded:', slots.length, 'slots');
        console.log('📋 Raw response data:', data);
        console.log('📋 Availability slots details:', slots.map((s: { id: string; caregiverId: string; date: string; startTime: string; endTime: string; availableSpots: number; status: string }) => ({
          id: s.id,
          caregiverId: s.caregiverId,
          date: s.date,
          start: s.startTime,
          end: s.endTime,
          spots: s.availableSpots,
          status: s.status
        })));

        // Also log unique dates for debugging
        const uniqueDates = [...new Set(slots.map((slot: { date: string }) => slot.date.split('T')[0]))].sort();
        console.log('📅 Unique dates available:', uniqueDates);

        // Auto-select the first available date if no date is selected
        if (slots.length > 0 && !bookingDetails.date && !bookingDetails.isMultiDay) {
          const firstAvailableDate = String(uniqueDates[0] ?? '');
          console.log('📅 Auto-selecting first available date:', firstAvailableDate);
          setBookingDetails(prev => ({ ...prev, date: firstAvailableDate }));
        }
      } else {
        console.error('❌ Failed to load availability:', data.error);
        setAvailabilityError(data.error || 'Failed to load availability');
      }
    } catch (error) {
      console.error('💥 Error fetching all availability:', error);
      setAvailabilityError('Failed to load availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Reservation timer countdown
  useEffect(() => {
    if (reservationTimer > 0) {
      const timer = setTimeout(() => {
        setReservationTimer(prev => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (reservationTimer === 0 && currentReservation) {
      // Reservation expired
      setCurrentReservation(null);
      setSelectedSlot(null);
      setError('Reservation expired. Please reserve spots again.');
      refreshAvailability();
    }
  }, [reservationTimer, currentReservation, refreshAvailability]);

  // Cleanup reservation when modal closes
  useEffect(() => {
    if (!isOpen && currentReservation) {
      handleCancelReservation();
    }
  }, [isOpen, currentReservation]);

  const checkChildProfiles = async () => {
    try {
      setChildrenLoading(true);
      const response = await fetch('/api/children');
      
      if (response.ok) {
        const result = await response.json();
        const profiles = result.success ? result.data : [];
        setChildProfiles(profiles);
        setHasChildren(profiles.length > 0);
      } else {
        console.error('Failed to fetch children profiles');
        setHasChildren(false);
        setChildProfiles([]);
      }
    } catch (error) {
      console.error('Error checking child profiles:', error);
      setHasChildren(false);
      setChildProfiles([]);
    } finally {
      setChildrenLoading(false);
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string) => {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // Handle child selection
  const handleChildSelection = (childId: string, isSelected: boolean) => {
    setBookingDetails(prev => ({
      ...prev,
      selectedChildIds: isSelected 
        ? [...prev.selectedChildIds, childId]
        : prev.selectedChildIds.filter(id => id !== childId)
    }));
  };

  // Get selected children details
  const getSelectedChildren = () => {
    return childProfiles.filter(child => bookingDetails.selectedChildIds.includes(child.id));
  };

  // Check if any selected children have special needs
  const hasSpecialNeeds = () => {
    const selectedChildren = getSelectedChildren();
    const hasValue = (val: any) => {
      if (Array.isArray(val)) return val.length > 0;
      return !!val;
    };
    return selectedChildren.some(child =>
      hasValue(child.allergies) || hasValue(child.medications) || hasValue(child.medicalConditions) || hasValue(child.dietaryRestrictions)
    );
  };

  // Handle spot reservation
  const handleReserveSpots = async (slotId: string) => {
    try {
      setError(null);
      const childrenCount = bookingDetails.selectedChildIds.length;
      
      if (childrenCount === 0) {
        setError('Please select at least one child before reserving spots');
        return;
      }

      const reservation = await reserveSpots({
        slotId,
        childrenCount,
        reservedSpots: childrenCount
      });

      setCurrentReservation(reservation);
      setSelectedSlot(slotId);
      
      // Start countdown timer (15 minutes = 900 seconds)
      setReservationTimer(900);
      
      // Refresh availability to show updated spots
      refreshAvailability();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reserve spots');
    }
  };

  // Cancel current reservation
  const handleCancelReservation = async () => {
    if (!currentReservation) return;
    
    try {
      await cancelReservation(currentReservation.id);
      setCurrentReservation(null);
      setSelectedSlot(null);
      setReservationTimer(0);
      refreshAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reservation');
    }
  };

  // Format time remaining for reservation
  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Find available slot for current time selection
  const getAvailableSlotForTime = () => {
    if (!availability?.slots || !bookingDetails.startTime || !bookingDetails.endTime) return null;
    
    const startTime = new Date(`${bookingDetails.date}T${bookingDetails.startTime}:00`);
    const endTime = new Date(`${bookingDetails.date}T${bookingDetails.endTime}:00`);
    
    return availability.slots.find(slot => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      return slotStart <= startTime && 
             slotEnd >= endTime && 
             (slot.realTimeAvailable || slot.availableSpots) >= bookingDetails.selectedChildIds.length;
    });
  };

  const handleCreatePayment = async () => {
    if (isCreatingPayment) {
      console.log('Payment creation already in progress, preventing duplicate');
      return;
    }
    
    // Check if CSRF token is available
    if (csrfLoading || !csrfToken) {
      setError('Security token not ready. Please wait a moment and try again.');
      return;
    }
    
    setIsCreatingPayment(true);
    setError(null);
    
    try {
      const response = await fetch('/api/stripe/payments/create-booking', {
        method: 'POST',
        headers: addCSRFHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          caregiverStripeAccountId: caregiver.stripeAccountId || 'acct_test_demo', // Demo account for testing
          amount: totalAmount,
          parentEmail: user?.email || 'parent@example.com',
          parentId: user?.id, // Parent user ID for Stripe customer creation
          parentName: user?.name || user?.profile?.firstName ? `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim() : undefined,
          caregiverName: caregiver.name,
          caregiverId: caregiver.id, // Add caregiver ID for booking creation
          bookingDetails: {
            ...bookingDetails,
            address: caregiver.location?.address || 'Address not provided',
            latitude: caregiver.location?.lat,
            longitude: caregiver.location?.lng,
            selectedChildren: getSelectedChildren().map(child => ({
              id: child.id,
              firstName: child.firstName,
              lastName: child.lastName,
              age: calculateAge(child.dateOfBirth),
              allergies: child.allergies,
              medications: child.medications,
              medicalConditions: child.medicalConditions,
              dietaryRestrictions: child.dietaryRestrictions,
              specialInstructions: child.specialInstructions,
              emergencyMedicalInfo: child.emergencyMedicalInfo
            })),
            childrenCount: bookingDetails.selectedChildIds.length,
          },
        }),
      });

      const data = await response.json();

      // API returns { success, data: { clientSecret, ... }, error }
      const paymentData = data.data || data;

      if (paymentData.clientSecret) {
        setClientSecret(paymentData.clientSecret);
        setStep('payment');
      } else {
        console.error('Failed to create payment:', data.error, data.details);
        setError(data.error || 'Failed to create payment. Please try again.');
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      setError('An error occurred while creating the payment. Please try again.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const stripeOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      ...stripeAppearance,
      variables: {
        colorPrimary: '#ef4444',
      },
    },
  };

  if (!isOpen) return null;

  // Check authentication first
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/20 dark:border-gray-700 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 rounded-xl pointer-events-none"></div>
          <div className="relative z-10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔐</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Login Required</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              You need to log in to book a caregiver.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/login';
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Login
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user is a parent
  if (!isParent) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/20 dark:border-gray-700 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 rounded-xl pointer-events-none"></div>
          <div className="relative z-10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚫</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Only parents can book caregiver services.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if parent has added children profiles
  if (childrenLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/20 dark:border-gray-700 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 rounded-xl pointer-events-none"></div>
          <div className="relative z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Checking your profile...</p>
          </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasChildren === false) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/20 dark:border-gray-700 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 rounded-xl pointer-events-none"></div>
          <div className="relative z-10">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">👶</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Add Child Profile Required</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              For safety and care quality, please add at least one child profile before booking childcare services.
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-6">
              Child profiles help caregivers provide the best possible care by knowing about allergies, medical conditions, and special instructions.
              Clicking "Add Child Profile" will take you directly to the Children section of your dashboard.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClose();
                  // Navigate to child profile creation in parent dashboard
                  router.push('/parent-dashboard?tab=children');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Add Child Profile
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-gray-700 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 rounded-xl pointer-events-none"></div>
        <div className="relative z-10">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <CaregiverProfileImage
                  name={caregiver.name}
                  id={caregiver.id}
                  imageUrl={caregiver.profilePhoto || caregiver.image}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Book with {caregiver.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">${caregiver.hourlyRate}/hour</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Error Display */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
                <span className="text-red-800 dark:text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        {step === 'details' && (
          <div className="p-4">
            {/* Booking Form with Smart Date/Time Selection */}
            <div className="space-y-3">
              {availabilityLoading ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-rose-500 border-t-transparent mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Loading {caregiver.name}'s availability...</p>
                </div>
              ) : availabilityError ? (
                <div className="text-center py-4 text-red-600 dark:text-red-400">
                  <p className="text-sm">Failed to load availability: {availabilityError}</p>
                </div>
              ) : allAvailability.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-3 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <CalendarDaysIcon className="h-6 w-6 text-orange-500 dark:text-orange-400" />
                  </div>
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">No Availability Posted Yet</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                    {caregiver.name} hasn't posted any available time slots yet.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                    <h5 className="font-medium text-blue-900 dark:text-blue-300 mb-2">💡 What you can do:</h5>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                      <li>• Send {caregiver.name} a message to ask about availability</li>
                      <li>• Check back later - caregivers often update their schedules</li>
                      <li>• Browse other caregivers who have posted availability</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="flex space-x-3 justify-center">
                      <button
                        onClick={() => {
                          onClose();
                          // Could redirect to messaging system
                          window.location.href = `/caregiver/${caregiver.id}?action=message`;
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        Message {caregiver.name.split(' ')[0]}
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          // Refresh the page to browse other caregivers
                          window.location.reload();
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm"
                      >
                        Browse Other Caregivers
                      </button>
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/notifications/availability-alerts', {
                              method: 'POST',
                              headers: addCSRFHeaders({ 'Content-Type': 'application/json' }),
                              body: JSON.stringify({ 
                                caregiverId: caregiver.id,
                                type: 'availability_posted'
                              })
                            });
                            
                            if (response.ok) {
                              alert(`✅ You'll be notified when ${caregiver.name} posts new availability!`);
                            } else {
                              alert('Unable to set up notifications at this time.');
                            }
                          } catch (error) {
                            console.error('Notification setup failed:', error);
                            alert('Unable to set up notifications at this time.');
                          }
                        }}
                        className="w-full px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition text-sm flex items-center justify-center space-x-2"
                      >
                        <span>🔔</span>
                        <span>Get notified when {caregiver.name.split(' ')[0]} posts availability</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Multi-day Toggle */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingDetails.isMultiDay}
                        onChange={(e) => {
                          const isMultiDay = e.target.checked;
                          setBookingDetails(prev => ({
                            ...prev,
                            isMultiDay,
                            // Reset dates when toggling
                            date: isMultiDay ? '' : prev.date,
                            startDate: isMultiDay ? prev.startDate : '',
                            endDate: isMultiDay ? prev.endDate : '',
                            startTime: '09:00',
                            endTime: '17:00'
                          }));
                        }}
                        className="mr-3 rounded text-rose-500 focus:ring-rose-500"
                      />
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">Multi-day booking</span>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Book for multiple consecutive days (3+ days get discount!)
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Date Selection */}
                  {bookingDetails.isMultiDay ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Start Date
                        </label>
                        <div className="relative">
                          <select
                            value={bookingDetails.startDate}
                            onChange={(e) => {
                              const startDate = e.target.value;
                              setBookingDetails(prev => ({ 
                                ...prev, 
                                startDate,
                                // Reset end date if it's before start date
                                endDate: prev.endDate && prev.endDate < startDate ? startDate : prev.endDate,
                                startTime: '',
                                endTime: ''
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-rose-500 focus:border-rose-500"
                            required
                          >
                            <option value="">Select start date...</option>
                            {(() => {
                              // Get unique available dates
                              const availableDates = [...new Set(allAvailability.map(slot => slot.date.split('T')[0]))].sort();
                              return availableDates.map(date => (
                                <option key={date} value={date}>
                                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </option>
                              ));
                            })()}
                          </select>
                          <CalendarDaysIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          End Date
                        </label>
                        <div className="relative">
                          <select
                            value={bookingDetails.endDate}
                            onChange={(e) => {
                              setBookingDetails(prev => ({ 
                                ...prev, 
                                endDate: e.target.value,
                                startTime: '',
                                endTime: ''
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-rose-500 focus:border-rose-500"
                            disabled={!bookingDetails.startDate}
                            required
                          >
                            <option value="">Select end date...</option>
                            {bookingDetails.startDate && (() => {
                              // Get available dates that are >= start date
                              const availableDates = [...new Set(allAvailability.map(slot => slot.date.split('T')[0]))]
                                .sort()
                                .filter(date => date >= bookingDetails.startDate);
                              
                              return availableDates.map(date => (
                                <option key={date} value={date}>
                                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </option>
                              ));
                            })()}
                          </select>
                          <CalendarDaysIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Date
                      </label>
                    <div className="relative">
                      <select
                        value={bookingDetails.date}
                        onChange={(e) => setBookingDetails(prev => ({ ...prev, date: e.target.value, startTime: '', endTime: '' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-rose-500 focus:border-rose-500"
                        required
                      >
                        <option value="">Select an available date...</option>
                        {(() => {
                          // Get unique available dates
                          const availableDates = [...new Set(allAvailability.map(slot => slot.date.split('T')[0]))].sort();
                          return availableDates.map(date => (
                            <option key={date} value={date}>
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </option>
                          ));
                        })()}
                      </select>
                      <CalendarDaysIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                    </div>
                  )}

                  {/* Multi-day date range display */}
                  {bookingDetails.isMultiDay && bookingDetails.startDate && bookingDetails.endDate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">📅 Multi-day Booking</h4>
                      <div className="space-y-1 text-sm dark:text-gray-200">
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-medium">{calculateDays()} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>From:</span>
                          <span className="font-medium">
                            {new Date(bookingDetails.startDate + 'T00:00:00').toLocaleDateString('en-US', { 
                              weekday: 'short', month: 'short', day: 'numeric' 
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>To:</span>
                          <span className="font-medium">
                            {new Date(bookingDetails.endDate + 'T00:00:00').toLocaleDateString('en-US', { 
                              weekday: 'short', month: 'short', day: 'numeric' 
                            })}
                          </span>
                        </div>
                        {calculateDays() >= 3 && (
                          <div className="flex justify-between text-green-700 dark:text-green-400">
                            <span>Discount:</span>
                            <span className="font-medium">
                              {calculateDays() >= 5 ? '10% off' : '5% off'} 🎉
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Time selection - works for both single and multi-day */}
                  {((bookingDetails.isMultiDay && bookingDetails.startDate && bookingDetails.endDate) || 
                    (!bookingDetails.isMultiDay && bookingDetails.date)) && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Start Time
                          </label>
                          <div className="relative">
                            <select
                              value={bookingDetails.startTime}
                              onChange={(e) => {
                                const selectedStartTime = e.target.value;
                                setBookingDetails(prev => ({ ...prev, startTime: selectedStartTime, endTime: '' }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-rose-500 focus:border-rose-500"
                            >
                              <option value="">Select start time...</option>
                              {(() => {
                                // Get all available time windows for selected date(s)
                                if (bookingDetails.isMultiDay) {
                                  // For multi-day bookings, need availability on ALL selected dates
                                  if (!bookingDetails.startDate || !bookingDetails.endDate) return [];
                                  
                                  // Get all dates in the range
                                  const startDate = new Date(bookingDetails.startDate);
                                  const endDate = new Date(bookingDetails.endDate);
                                  const dateRange: string[] = [];

                                  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                                    dateRange.push(d.toISOString().split('T')[0]);
                                  }
                                  
                                  console.log('🗓️ Multi-day range:', dateRange);
                                  
                                  // Find time slots that exist on ALL dates in the range
                                  const commonTimeSlots: Array<{ startTime: string; endTime: string; slotStart: Date; slotEnd: Date }> = [];

                                  // Group slots by time range - USE LOCAL TIME consistently
                                  // Since we display times in local time to users, we need to use local time for grouping too
                                  const timeSlotGroups: Record<string, { dates: string[], startLocal: DateTime, endLocal: DateTime }> = {};
                                  allAvailability.forEach(slot => {
                                    const slotDate = slot.date.split('T')[0];
                                    if (dateRange.includes(slotDate) && slot.availableSpots > 0) {
                                      // Convert UTC slot times to user's local timezone
                                      const startLocal = toLocalDateTime(slot.startTime, userTimezone);
                                      const endLocal = toLocalDateTime(slot.endTime, userTimezone);

                                      // Use user's timezone for display grouping
                                      const timeKey = `${startLocal.toFormat('HH:mm')}-${endLocal.toFormat('HH:mm')}`;
                                      if (!timeSlotGroups[timeKey]) {
                                        timeSlotGroups[timeKey] = { dates: [], startLocal, endLocal };
                                      }
                                      timeSlotGroups[timeKey].dates.push(slotDate);
                                    }
                                  });
                                  
                                  // Only include time slots that are available on ALL dates
                                  const commonTimeSlotsFinal: Array<{ startLocal: DateTime; endLocal: DateTime }> = [];
                                  Object.entries(timeSlotGroups).forEach(([timeKey, slotData]) => {
                                    if (slotData.dates.length === dateRange.length) {
                                      commonTimeSlotsFinal.push({ startLocal: slotData.startLocal, endLocal: slotData.endLocal });
                                    }
                                  });

                                  console.log('🕐 Common time slots for multi-day:', commonTimeSlotsFinal);

                                  if (commonTimeSlotsFinal.length === 0) {
                                    return [(
                                      <option key="no-times" value="" disabled className="text-gray-500">
                                        No times available for all selected dates
                                      </option>
                                    )];
                                  }

                                  const availableTimeRanges: string[] = [];
                                  commonTimeSlotsFinal.forEach(({ startLocal, endLocal }) => {
                                    // Use user's timezone hours for time generation
                                    const startMinutes = startLocal.hour * 60 + startLocal.minute;
                                    let endMinutes = endLocal.hour * 60 + endLocal.minute;
                                    // Handle overnight slots
                                    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

                                    // Generate hourly start times
                                    for (let min = startMinutes; min < endMinutes; min += 60) {
                                      const hour = Math.floor((min % (24 * 60)) / 60);
                                      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                                      if (!availableTimeRanges.includes(timeStr)) {
                                        availableTimeRanges.push(timeStr);
                                      }
                                    }

                                    // Add half-hour intervals
                                    for (let min = startMinutes + 30; min < endMinutes; min += 60) {
                                      const hour = Math.floor((min % (24 * 60)) / 60);
                                      const timeStr = `${hour.toString().padStart(2, '0')}:30`;
                                      if (!availableTimeRanges.includes(timeStr)) {
                                        availableTimeRanges.push(timeStr);
                                      }
                                    }

                                    // Add the exact slot start time
                                    const exactStart = `${startLocal.hour.toString().padStart(2, '0')}:${startLocal.minute.toString().padStart(2, '0')}`;
                                    if (!availableTimeRanges.includes(exactStart)) {
                                      availableTimeRanges.push(exactStart);
                                    }
                                  });
                                  
                                  return availableTimeRanges.sort().map(time => (
                                    <option key={time} value={time}>
                                      {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
                                        hour: 'numeric', 
                                        minute: '2-digit',
                                        hour12: true 
                                      })}
                                    </option>
                                  ));
                                  
                                } else {
                                  // Single-day booking logic (existing)
                                  const targetDate = bookingDetails.date;
                                  if (!targetDate) return [];
                                  
                                  console.log('🕐 Single-day Time Selection Debug:', {
                                    targetDate,
                                    allAvailabilityCount: allAvailability.length,
                                    allAvailabilityDates: allAvailability.map(s => s.date.split('T')[0]),
                                    sampleSlot: allAvailability[0] ? {
                                      date: allAvailability[0].date,
                                      startTime: allAvailability[0].startTime,
                                      endTime: allAvailability[0].endTime,
                                      availableSpots: allAvailability[0].availableSpots
                                    } : null
                                  });

                                  const selectedDateSlots = allAvailability.filter(slot =>
                                    slot.date.split('T')[0] === targetDate && slot.availableSpots > 0
                                  );

                                  console.log('🎯 Selected Date Slots:', {
                                    targetDate,
                                    slotsFound: selectedDateSlots.length,
                                    slots: selectedDateSlots.map(s => ({
                                      date: s.date,
                                      start: s.startTime,
                                      end: s.endTime,
                                      spots: s.availableSpots
                                    }))
                                  });
                                  
                                  if (selectedDateSlots.length === 0) {
                                    return [(
                                      <option key="no-times" value="" disabled className="text-gray-500">
                                        No times available for this date
                                      </option>
                                    )];
                                  }
                                  
                                  const availableTimeRanges: string[] = [];
                                  selectedDateSlots.forEach(slot => {
                                    // Convert UTC slot times to user's local timezone using Luxon
                                    const slotStartLocal = toLocalDateTime(slot.startTime, userTimezone);
                                    const slotEndLocal = toLocalDateTime(slot.endTime, userTimezone);

                                    const startMinutes = slotStartLocal.hour * 60 + slotStartLocal.minute;
                                    let endMinutes = slotEndLocal.hour * 60 + slotEndLocal.minute;
                                    // Handle overnight slots
                                    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

                                    // Generate hourly start times within the slot - LOCAL TIMEZONE HOURS
                                    for (let min = startMinutes; min < endMinutes; min += 60) {
                                      const hour = Math.floor((min % (24 * 60)) / 60);
                                      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                                      if (!availableTimeRanges.includes(timeStr)) {
                                        availableTimeRanges.push(timeStr);
                                      }
                                    }

                                    // Add half-hour intervals - LOCAL TIMEZONE HOURS
                                    for (let min = startMinutes + 30; min < endMinutes; min += 60) {
                                      const hour = Math.floor((min % (24 * 60)) / 60);
                                      const timeStr = `${hour.toString().padStart(2, '0')}:30`;
                                      if (!availableTimeRanges.includes(timeStr)) {
                                        availableTimeRanges.push(timeStr);
                                      }
                                    }

                                    // Add the exact slot start time - LOCAL TIMEZONE
                                    const exactStart = `${slotStartLocal.hour.toString().padStart(2, '0')}:${slotStartLocal.minute.toString().padStart(2, '0')}`;
                                    if (!availableTimeRanges.includes(exactStart)) {
                                      availableTimeRanges.push(exactStart);
                                    }
                                  });

                                  // Filter out past times if the selected date is today
                                  const now = DateTime.now().setZone(userTimezone);
                                  const todayStr = now.toFormat('yyyy-MM-dd');
                                  const isToday = targetDate === todayStr;

                                  let filteredTimeRanges = availableTimeRanges;
                                  if (isToday) {
                                    const currentHour = now.hour;
                                    const currentMinute = now.minute;
                                    filteredTimeRanges = availableTimeRanges.filter(time => {
                                      const [timeHour, timeMinute] = time.split(':').map(Number);
                                      // Only show times that are at least 30 minutes in the future
                                      const timeInMinutes = timeHour * 60 + timeMinute;
                                      const currentTimeInMinutes = currentHour * 60 + currentMinute + 30; // 30 min buffer
                                      return timeInMinutes >= currentTimeInMinutes;
                                    });
                                  }

                                  if (filteredTimeRanges.length === 0) {
                                    return [(
                                      <option key="no-future-times" value="" disabled className="text-gray-500">
                                        {isToday ? "No bookable times left today — try tomorrow" : "No times available for this date"}
                                      </option>
                                    )];
                                  }

                                  return filteredTimeRanges.sort().map(time => (
                                    <option key={time} value={time}>
                                      {new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </option>
                                  ));
                                }
                              })()}
                            </select>
                            <ClockIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            End Time
                          </label>
                          <div className="relative">
                            <select
                              value={bookingDetails.endTime}
                              onChange={(e) => setBookingDetails(prev => ({ ...prev, endTime: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-rose-500 focus:border-rose-500"
                              disabled={!bookingDetails.startTime}
                            >
                              <option value="">Select end time...</option>
                              {bookingDetails.startTime && (() => {
                                const targetDate = bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date;
                                if (!targetDate) return [];
                                
                                const selectedDateSlots = allAvailability.filter(slot =>
                                  slot.date.split('T')[0] === targetDate && slot.availableSpots > 0
                                );

                                console.log('🕐 End Time Debug:', {
                                  targetDate,
                                  selectedStartTime: bookingDetails.startTime,
                                  selectedDateSlots: selectedDateSlots.map(s => ({
                                    id: s.id,
                                    date: s.date,
                                    startTime: s.startTime,
                                    endTime: s.endTime,
                                    spots: s.availableSpots
                                  }))
                                });

                                const availableEndTimes: string[] = [];
                                selectedDateSlots.forEach(slot => {
                                  try {
                                    // Convert UTC slot times to user's local timezone using Luxon
                                    const slotStartLocal = toLocalDateTime(slot.startTime, userTimezone);
                                    const slotEndLocal = toLocalDateTime(slot.endTime, userTimezone);
                                    const selectedStartTime = bookingDetails.startTime;
                                    const [startHour, startMin] = selectedStartTime.split(':').map(Number);

                                    // Use local timezone hours for comparison
                                    const slotStartMinutes = slotStartLocal.hour * 60 + slotStartLocal.minute;
                                    let slotEndMinutes = slotEndLocal.hour * 60 + slotEndLocal.minute;
                                    // Handle overnight slots
                                    if (slotEndMinutes <= slotStartMinutes) {
                                      slotEndMinutes += 24 * 60;
                                    }

                                    const selectedStartMinutes = startHour * 60 + startMin;

                                    console.log('🔍 Slot comparison (LOCAL TIME):', {
                                      slotStartLocal: slotStartLocal.toFormat('HH:mm'),
                                      slotEndLocal: slotEndLocal.toFormat('HH:mm'),
                                      selectedStart: selectedStartTime,
                                      timezone: userTimezone,
                                      slotStartMinutes,
                                      slotEndMinutes,
                                      selectedStartMinutes,
                                      startsWithinSlot: selectedStartMinutes >= slotStartMinutes && selectedStartMinutes < slotEndMinutes
                                    });

                                    if (selectedStartMinutes >= slotStartMinutes && selectedStartMinutes < slotEndMinutes) {
                                      // Generate possible end times from 1 hour after start up to slot end
                                      const minEndMinutes = selectedStartMinutes + 60; // Minimum 1 hour booking

                                      // Generate hourly and half-hourly end times - LOCAL TIMEZONE
                                      for (let currentMinutes = minEndMinutes; currentMinutes <= slotEndMinutes; currentMinutes += 30) {
                                        const hour = Math.floor((currentMinutes % (24 * 60)) / 60);
                                        const min = currentMinutes % 60;
                                        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                                        if (!availableEndTimes.includes(timeStr)) {
                                          availableEndTimes.push(timeStr);
                                        }
                                      }

                                      // Add the exact slot end time - LOCAL TIMEZONE
                                      const exactEnd = `${slotEndLocal.hour.toString().padStart(2, '0')}:${slotEndLocal.minute.toString().padStart(2, '0')}`;
                                      if (!availableEndTimes.includes(exactEnd)) {
                                        availableEndTimes.push(exactEnd);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error processing slot for end times:', error, slot);
                                  }
                                });
                                
                                return availableEndTimes.sort().map(time => (
                                  <option key={time} value={time}>
                                    {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </option>
                                ));
                              })()}
                            </select>
                            <ClockIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Show message when date is selected but no times are available */}
                      {((bookingDetails.isMultiDay && bookingDetails.startDate) || 
                        (!bookingDetails.isMultiDay && bookingDetails.date)) && 
                       (!bookingDetails.startTime || !bookingDetails.endTime) && (() => {
                        const targetDate = bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date;
                        const selectedDateSlots = allAvailability.filter(slot => 
                          slot.date.split('T')[0] === targetDate && slot.availableSpots > 0
                        );
                        
                        if (selectedDateSlots.length === 0) {
                          return (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                              <h4 className="font-medium text-yellow-900 dark:text-yellow-300 mb-1">⚠️ No Times Available</h4>
                              <p className="text-yellow-800 dark:text-yellow-300 text-sm mb-2">
                                {caregiver.name} hasn't posted any available time slots for this date.
                              </p>
                              <div className="text-yellow-700 dark:text-yellow-400 text-xs">
                                <p>• Try selecting a different date</p>
                                <p>• Contact {caregiver.name} to ask about availability</p>
                                <p>• Check if there are other caregivers available</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Show slot details when date/time are selected */}
                      {((bookingDetails.isMultiDay && bookingDetails.startDate) || 
                        (!bookingDetails.isMultiDay && bookingDetails.date)) && 
                       bookingDetails.startTime && bookingDetails.endTime && (() => {
                        // Find the caregiver slot that contains the selected booking time
                        const [startHour, startMin] = bookingDetails.startTime.split(':').map(Number);
                        const [endHour, endMin] = bookingDetails.endTime.split(':').map(Number);
                        const targetDate = bookingDetails.isMultiDay ? bookingDetails.startDate : bookingDetails.date;
                        
                        // Find ALL matching slots and pick the smallest one (most specific match)
                        const matchingSlots = allAvailability.filter(slot => {
                          if (slot.date.split('T')[0] !== targetDate) return false;

                          // Convert UTC slot times to user's local timezone using Luxon
                          const slotStartLocal = toLocalDateTime(slot.startTime, userTimezone);
                          const slotEndLocal = toLocalDateTime(slot.endTime, userTimezone);

                          // Use local timezone hours for comparison (matches dropdown generation)
                          const slotStartMinutes = slotStartLocal.hour * 60 + slotStartLocal.minute;
                          let slotEndMinutes = slotEndLocal.hour * 60 + slotEndLocal.minute;
                          // Handle overnight slots
                          if (slotEndMinutes <= slotStartMinutes) {
                            slotEndMinutes += 24 * 60;
                          }

                          const bookingStartMinutes = startHour * 60 + startMin;
                          let bookingEndMinutes = endHour * 60 + endMin;
                          // Handle overnight bookings
                          if (bookingEndMinutes <= bookingStartMinutes) {
                            bookingEndMinutes += 24 * 60;
                          }

                          const isValid = bookingStartMinutes >= slotStartMinutes &&
                                          bookingEndMinutes <= slotEndMinutes &&
                                          slot.availableSpots > 0;

                          console.log('🔍 Validation comparison (LOCAL time):', {
                            slotId: slot.id,
                            slotStartLocal: slotStartLocal.toFormat('HH:mm'),
                            slotEndLocal: slotEndLocal.toFormat('HH:mm'),
                            bookingStart: `${startHour}:${startMin.toString().padStart(2, '0')}`,
                            bookingEnd: `${endHour}:${endMin.toString().padStart(2, '0')}`,
                            timezone: userTimezone,
                            slotStartMinutes,
                            slotEndMinutes,
                            bookingStartMinutes,
                            bookingEndMinutes,
                            availableSpots: slot.availableSpots,
                            isValid
                          });

                          return isValid;
                        });

                        // Sort by slot duration (smallest first) to get the most specific match
                        const matchingSlot = matchingSlots.sort((a, b) => {
                          const durationA = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
                          const durationB = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
                          return durationA - durationB;
                        })[0];
                        
                        if (matchingSlot) {
                          const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                          const hours = Math.floor(duration / 60);
                          const minutes = duration % 60;
                          const durationText = hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
                          
                          return (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <h4 className="font-medium text-gray-900 dark:text-white mb-1">✅ Valid Booking Selection</h4>
                              <div className="space-y-1 text-sm dark:text-gray-200">
                                <div className="flex justify-between">
                                  <span>Booking duration:</span>
                                  <span className="font-medium">{durationText}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Available spots:</span>
                                  <span className="font-medium">{matchingSlot.availableSpots}/{matchingSlot.totalCapacity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Rate:</span>
                                  <span className="font-medium">{formatCAD(matchingSlot.baseRate * 100)}/hour</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Total cost:</span>
                                  <span className="font-medium text-green-700 dark:text-green-400">{formatCAD(Math.round(duration / 60 * matchingSlot.baseRate * 100))}</span>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                              <h4 className="font-medium text-red-900 dark:text-red-300 mb-1">❌ Invalid Selection</h4>
                              <p className="text-red-700 dark:text-red-400 text-sm">
                                The selected time doesn't fall within any available caregiver slots.
                              </p>
                            </div>
                          );
                        }
                      })()}
                    </>
                  )}
                </>
              )}

              {/* Reservation Status */}
              {currentReservation && reservationTimer > 0 && (
                <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-yellow-800 dark:text-yellow-300 font-medium">
                      Time Slot Reserved
                    </span>
                  </div>
                  <div className="text-yellow-700 dark:text-yellow-400 text-sm">
                    You have reserved spots for <strong>{formatTimeRemaining(reservationTimer)}</strong>
                  </div>
                  <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                    Complete your booking before the timer expires or spots will be released
                  </div>
                  <button
                    onClick={handleCancelReservation}
                    className="mt-2 text-red-600 hover:text-red-800 dark:text-red-300 text-sm font-medium"
                  >
                    Cancel Reservation
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Select Children
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSpecialRequests(!showSpecialRequests)}
                    className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                      showSpecialRequests || bookingDetails.specialRequests
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/40'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Special Requests
                    {bookingDetails.specialRequests && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>}
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {childProfiles.map(child => (
                    <label 
                      key={child.id} 
                      className={`flex items-center space-x-3 p-2 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        bookingDetails.selectedChildIds.includes(child.id) 
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' 
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={bookingDetails.selectedChildIds.includes(child.id)}
                        onChange={(e) => handleChildSelection(child.id, e.target.checked)}
                        className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      
                      {/* Child Photo */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        {child.photoUrl ? (
                          <Image
                            src={child.photoUrl}
                            width={32}
                            height={32}
                            alt={`${child.firstName} ${child.lastName}`}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                            {child.firstName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {/* Child Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {child.firstName} {child.lastName}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Age {calculateAge(child.dateOfBirth)}
                          </span>
                        </div>
                        
                        {/* Special Needs Indicators */}
                        {((Array.isArray(child.allergies) ? child.allergies.length > 0 : child.allergies) ||
                          (Array.isArray(child.medications) ? child.medications.length > 0 : child.medications) ||
                          (Array.isArray(child.medicalConditions) ? child.medicalConditions.length > 0 : child.medicalConditions) ||
                          child.dietaryRestrictions) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(child.allergies) ? child.allergies.length > 0 : child.allergies) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                🥜 Allergies
                              </span>
                            )}
                            {(Array.isArray(child.medications) ? child.medications.length > 0 : child.medications) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                💊 Medication
                              </span>
                            )}
                            {(Array.isArray(child.medicalConditions) ? child.medicalConditions.length > 0 : child.medicalConditions) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                🏥 Medical
                              </span>
                            )}
                            {child.dietaryRestrictions && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                🥗 Diet
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                  
                  {childProfiles.length === 0 && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No child profiles found. Please add children to your profile first.
                    </div>
                  )}
                </div>
                
                {bookingDetails.selectedChildIds.length === 0 && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">Please select at least one child</p>
                )}
              </div>

              {/* Collapsible Special Requests Section */}
              {showSpecialRequests && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Special Requests (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSpecialRequests(false)}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    value={bookingDetails.specialRequests}
                    onChange={(e) => setBookingDetails(prev => ({ ...prev, specialRequests: e.target.value }))}
                    rows={2}
                    placeholder="Any special requirements or notes for the caregiver..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg focus:ring-rose-500 focus:border-rose-500 resize-none text-sm"
                    autoFocus
                  />
                </div>
              )}

              {/* Split Payment Option - HIDDEN: Feature not yet fully implemented
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookingDetails.isSplitPayment}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBookingDetails(prev => ({
                          ...prev,
                          isSplitPayment: checked,
                          splitParties: checked ? [
                            { name: '', email: '', percentage: 50 },
                            { name: '', email: '', percentage: 50 }
                          ] : []
                        }));
                      }}
                      className="mr-2 rounded text-rose-500 focus:ring-rose-500"
                    />
                    <span className="font-medium text-gray-700 dark:text-gray-200">Split Payment (Shared Custody)</span>
                  </label>
                </div>

                {bookingDetails.isSplitPayment && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Split the cost between multiple parties</p>
                    {bookingDetails.splitParties.map((party, index) => (
                      <div key={index} className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Name"
                          value={party.name}
                          onChange={(e) => {
                            const newParties = [...bookingDetails.splitParties];
                            newParties[index].name = e.target.value;
                            setBookingDetails(prev => ({ ...prev, splitParties: newParties }));
                          }}
                          className="px-2 py-1 text-sm border rounded"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={party.email}
                          onChange={(e) => {
                            const newParties = [...bookingDetails.splitParties];
                            newParties[index].email = e.target.value;
                            setBookingDetails(prev => ({ ...prev, splitParties: newParties }));
                          }}
                          className="px-2 py-1 text-sm border rounded"
                        />
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={party.percentage}
                            onChange={(e) => {
                              const newParties = [...bookingDetails.splitParties];
                              newParties[index].percentage = parseInt(e.target.value) || 0;
                              // Auto-adjust other party if only 2 parties
                              if (newParties.length === 2) {
                                const otherIndex = index === 0 ? 1 : 0;
                                newParties[otherIndex].percentage = 100 - newParties[index].percentage;
                              }
                              setBookingDetails(prev => ({ ...prev, splitParties: newParties }));
                            }}
                            className="w-16 px-2 py-1 text-sm border rounded"
                          />
                          <span className="ml-1 text-sm">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              */}

              {/* Booking Summary */}
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Booking Summary</h4>
                <div className="space-y-1 text-sm dark:text-gray-200">
                  {bookingDetails.isMultiDay ? (
                    <>
                      <div className="flex justify-between">
                        <span>Days:</span>
                        <span>{calculateDays()} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hours per day:</span>
                        <span>{calculateHours()} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total hours:</span>
                        <span>{calculateHours() * calculateDays()} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate:</span>
                        <span>${caregiver.hourlyRate}/hour</span>
                      </div>
                      {calculateDays() >= 3 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Multi-day discount:</span>
                          <span>{calculateDays() >= 5 ? '10% off' : '5% off'}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span>{calculateHours()} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate:</span>
                        <span>${caregiver.hourlyRate}/hour</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>Children:</span>
                    <div className="text-right">
                      <span className="font-medium">
                        {getSelectedChildren().map(child => child.firstName).join(', ') || 'None selected'}
                      </span>
                      {hasSpecialNeeds() && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">⚠️ Special needs noted</div>
                      )}
                    </div>
                  </div>
                  {bookingDetails.isSplitPayment && (
                    <div className="pt-1 space-y-1 border-t border-rose-200 dark:border-rose-800">
                      {bookingDetails.splitParties.map((party, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span>{party.name || `Party ${index + 1}`}:</span>
                          <span>{formatCAD((totalAmount * party.percentage) / 100)} ({party.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-rose-200 dark:border-rose-800 pt-1 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>{formatCAD(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirmation')}
                disabled={
                  (bookingDetails.isMultiDay ? 
                    (!bookingDetails.startDate || !bookingDetails.endDate) : 
                    !bookingDetails.date) ||
                  !bookingDetails.startTime || 
                  !bookingDetails.endTime || 
                  bookingDetails.selectedChildIds.length === 0
                }
                className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition"
                title={
                  (bookingDetails.isMultiDay ? 
                    (!bookingDetails.startDate || !bookingDetails.endDate) : 
                    !bookingDetails.date) ? 
                    "Please select dates and time" : 
                    bookingDetails.selectedChildIds.length === 0 ? 
                      "Please select children" : ""
                }
              >
                {((bookingDetails.isMultiDay && bookingDetails.startDate && bookingDetails.endDate) || 
                  (!bookingDetails.isMultiDay && bookingDetails.date)) && 
                 bookingDetails.selectedChildIds.length > 0 ? 
                  'Review Booking' : 
                  'Select Dates, Time & Children'
                }
              </button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="p-4">
            {/* Booking Confirmation */}
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">⚠️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Confirm Booking Details</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Please verify you're booking with the correct caregiver
              </p>
            </div>

            {/* Caregiver Verification */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Caregiver Details</h4>
              <div className="space-y-2 text-sm dark:text-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Name:</span>
                  <span className="font-medium">{caregiver.name}</span>
                </div>
                {caregiver.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Email:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{caregiver.email}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Rate:</span>
                  <span className="font-medium">${caregiver.hourlyRate}/hour</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Experience:</span>
                  <span className="font-medium">{caregiver.experience}</span>
                </div>
              </div>
            </div>

            {/* Selected Children Details */}
            {getSelectedChildren().length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Children in This Booking</h4>
                <div className="space-y-2">
                  {getSelectedChildren().map(child => (
                    <div key={child.id} className="flex items-start space-x-3 p-2 bg-white dark:bg-gray-700 rounded-lg">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        {child.photoUrl ? (
                          <Image
                            src={child.photoUrl}
                            width={32}
                            height={32}
                            alt={`${child.firstName}`}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                            {child.firstName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {child.firstName} {child.lastName} (Age {calculateAge(child.dateOfBirth)})
                        </div>
                        {((Array.isArray(child.allergies) ? child.allergies.length > 0 : child.allergies) ||
                          (Array.isArray(child.medications) ? child.medications.length > 0 : child.medications) ||
                          (Array.isArray(child.medicalConditions) ? child.medicalConditions.length > 0 : child.medicalConditions) ||
                          child.dietaryRestrictions) && (
                          <div className="mt-2 space-y-1 text-xs">
                            {(Array.isArray(child.allergies) ? child.allergies.length > 0 : child.allergies) && (
                              <div className="text-orange-700 dark:text-orange-400"><strong>Allergies:</strong> {
                                Array.isArray(child.allergies)
                                  ? child.allergies.map((a: any) => typeof a === 'object' ? a.name : a).join(', ')
                                  : child.allergies
                              }</div>
                            )}
                            {(Array.isArray(child.medications) ? child.medications.length > 0 : child.medications) && (
                              <div className="text-blue-700 dark:text-blue-400"><strong>Medications:</strong> {
                                Array.isArray(child.medications)
                                  ? child.medications.map((m: any) => typeof m === 'object' ? m.name : m).join(', ')
                                  : child.medications
                              }</div>
                            )}
                            {(Array.isArray(child.medicalConditions) ? child.medicalConditions.length > 0 : child.medicalConditions) && (
                              <div className="text-red-700 dark:text-red-400"><strong>Medical:</strong> {
                                Array.isArray(child.medicalConditions)
                                  ? child.medicalConditions.map((c: any) => typeof c === 'object' ? c.name : c).join(', ')
                                  : child.medicalConditions
                              }</div>
                            )}
                            {child.dietaryRestrictions && (
                              <div className="text-green-700 dark:text-green-400"><strong>Diet:</strong> {child.dietaryRestrictions}</div>
                            )}
                            {child.specialInstructions && (
                              <div className="text-purple-700 dark:text-purple-400"><strong>Instructions:</strong> {child.specialInstructions}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {hasSpecialNeeds() && (
                  <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-sm text-orange-800 dark:text-orange-300">
                    <strong>⚠️ Important:</strong> This booking includes children with special care requirements. Please review all details carefully.
                  </div>
                )}
              </div>
            )}

            {/* Booking Summary */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Booking Summary</h4>
              <div className="space-y-2 text-sm dark:text-gray-200">
                {bookingDetails.isMultiDay ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Start Date:</span>
                      <span className="font-medium">
                        {new Date(bookingDetails.startDate + 'T00:00:00').toLocaleDateString('en-US', { 
                          weekday: 'short', month: 'short', day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">End Date:</span>
                      <span className="font-medium">
                        {new Date(bookingDetails.endDate + 'T00:00:00').toLocaleDateString('en-US', { 
                          weekday: 'short', month: 'short', day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Duration:</span>
                      <span className="font-medium">{calculateDays()} days × {calculateHours()} hours/day</span>
                    </div>
                    {calculateDays() >= 3 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Multi-day discount:</span>
                        <span className="font-medium">{calculateDays() >= 5 ? '10% off' : '5% off'}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Date:</span>
                      <span className="font-medium">{bookingDetails.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Duration:</span>
                      <span className="font-medium">{calculateHours()} hours</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Time:</span>
                  <span className="font-medium">{bookingDetails.startTime} - {bookingDetails.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Children:</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {getSelectedChildren().map(child => `${child.firstName} (${calculateAge(child.dateOfBirth)})`).join(', ') || 'None selected'}
                    </span>
                    {hasSpecialNeeds() && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">⚠️ Special care required</div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between border-t dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white font-medium">Total:</span>
                  <span className="font-bold text-lg">{formatCAD(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-red-800 dark:text-red-300 text-sm font-medium">
                ⚠️ Please verify this is the correct caregiver before proceeding to payment.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('details')}
                className="flex-1 px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white transition"
              >
                Back to Edit
              </button>
              <button
                onClick={handleCreatePayment}
                disabled={isCreatingPayment}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition font-medium"
              >
                {isCreatingPayment ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && clientSecret && (
          // Always wrap BookingForm with Elements provider, even in demo mode
          // This ensures useStripe() and useElements() hooks work without context errors
          <Elements
            options={clientSecret.includes('_secret_demo') ? {
              // Demo mode - use minimal options to avoid Stripe API calls
              appearance: {
                ...stripeAppearance,
                variables: {
                  colorPrimary: '#ef4444',
                },
              },
            } : stripeOptions} 
            stripe={clientSecret.includes('_secret_demo') ? Promise.resolve(null) : getStripePromise()}
          >
            <BookingForm
              clientSecret={clientSecret}
              bookingDetails={bookingDetails}
              caregiver={caregiver}
              totalAmount={totalAmount}
              commissionRate={commissionRate}
              onSuccess={() => {
                // Refresh availability data to show updated spots
                fetchAllAvailability();
                refreshAvailability();

                // Show success message with option to book again
                const bookAnother = confirm(
                  `Booking confirmed! ${getSelectedChildren().map(c => c.firstName).join(', ')} will be cared for by ${caregiver.name}.\n\nWould you like to book another session with ${caregiver.name}?`
                );

                if (bookAnother) {
                  // Reset form for new booking
                  setStep('details');
                  setBookingDetails(prev => ({
                    ...prev,
                    isMultiDay: false,
                    startDate: '',
                    endDate: '',
                    date: '',
                    startTime: '09:00',
                    endTime: '17:00',
                    selectedChildIds: [],
                    specialRequests: '',
                    isSplitPayment: false,
                    splitParties: []
                  }));
                  setClientSecret('');
                } else {
                  onClose();
                }
              }}
              onBack={() => setStep('details')}
            />
          </Elements>
        )}
        </div>
      </div>
    </div>
  );
}