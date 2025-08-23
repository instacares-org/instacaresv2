'use client';

import React, { useState, useEffect } from 'react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
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
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Chat from '../../components/Chat';
import ChatWebSocket from '../../components/ChatWebSocket';
import OrganizedMessagesContainer from '../../components/OrganizedMessagesContainer';
import NotificationSettings from '../../components/NotificationSettings';
import NotificationInitializer from '../../components/NotificationInitializer';
import { useUnreadMessageCount } from '../../hooks/useUnreadMessageCount';
import { useNotificationStorage } from '../../hooks/useNotificationStorage';
import ReviewForm, { ReviewFormData } from '../../components/ReviewForm';
import ReviewList from '../../components/ReviewList';
import ChildProfile from '../../components/ChildProfile';
import ThemeToggle from '../../components/ThemeToggle';

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
  caregiverName: string;
  caregiverPhoto?: string;
  caregiverRating: number;
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
    city: string;
    province: string;
    postalCode: string;
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

const ParentDashboard: React.FC = () => {
  const { user, loading: authLoading, isAuthenticated, isParent, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'bookings' | 'messages' | 'notifications' | 'children'>('overview');
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [showChildProfile, setShowChildProfile] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  
  // Review states
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  
  // Use real notification storage
  const { 
    notifications, 
    unreadCount: realUnreadCount, 
    markAsRead: markNotificationAsRead,
    markAllAsRead,
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

  // Redirect if not authenticated or not a parent
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !isParent) {
        router.push('/login/parent');
      }
    }
  }, [authLoading, isAuthenticated, isParent, router]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading]);

  // Initialize welcome notifications for new users (separate effect to avoid infinite loop)
  useEffect(() => {
    if (user && notifications.length === 0) {
      // Use a flag to prevent multiple executions
      const notificationInitialized = localStorage.getItem(`notifications-initialized-${user.id}`);
      
      if (!notificationInitialized) {
        // Add welcome notification for new users
        addSystemNotification('Welcome to Instacares!', 'Thank you for joining Instacares. You can now book trusted caregivers for your children.');
        
        // Add some sample notifications to show the system working
        setTimeout(() => {
          addBookingNotification('Booking Confirmed', 'Your booking with Emily Davis for Aug 15 has been confirmed.', 'booking-1', 'confirmation');
        }, 1000);
        
        setTimeout(() => {
          addMessageNotification('Jennifer Chen', 'Hello! I wanted to confirm the details for our upcoming session.', 'room-1');
        }, 2000);

        // Mark as initialized
        localStorage.setItem(`notifications-initialized-${user.id}`, 'true');
      }
    }
  }, [user?.id, notifications.length]); // Only depend on user.id and notification count

  // Fetch children from API
  const fetchChildren = async () => {
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
  };

  // Fetch bookings from API
  const fetchBookings = async () => {
    if (!user) return [];
    
    try {
      const response = await fetch(`/api/bookings?userId=${user.id}&userType=parent`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Transform API data to match parent dashboard Booking interface
        return result.data.map((booking: any) => {
          const startDate = new Date(booking.startTime);
          const endDate = new Date(booking.endTime);
          
          // Format date as YYYY-MM-DD using local timezone to avoid timezone shifts
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          const day = String(startDate.getDate()).padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          
          // Format times as HH:MM using local timezone
          const startTime = startDate.toTimeString().substring(0, 5);
          const endTime = endDate.toTimeString().substring(0, 5);
          
          return {
            id: booking.id,
            caregiverId: booking.caregiverId,
            caregiverName: `${booking.caregiver?.profile?.firstName || ''} ${booking.caregiver?.profile?.lastName || ''}`.trim() || 'Unknown Caregiver',
            caregiverPhoto: booking.caregiver?.profile?.avatar || undefined,
            caregiverRating: 4.8, // TODO: Get from caregiver data
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
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Create profile from authenticated user data
      const userProfile: ParentProfile = {
        id: user.id,
        firstName: user.profile?.firstName || 'Parent',
        lastName: user.profile?.lastName || 'User',
        email: user.email,
        phone: user.profile?.phone || 'Not provided',
        address: {
          street: user.profile?.streetAddress || '',
          apartment: user.profile?.apartment || '',
          city: user.profile?.city || '',
          province: user.profile?.state || '',
          postalCode: user.profile?.zipCode || '',
          latitude: undefined,
          longitude: undefined,
        },
        emergencyContact: {
          name: user.profile?.emergencyName || 'Not provided',
          phone: user.profile?.emergencyPhone || 'Not provided',
          relationship: user.profile?.emergencyRelation || 'Not provided'
        },
        profilePhoto: user.profile?.avatar || undefined,
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

      const mockBookings: Booking[] = [
        {
          id: 'booking-1',
          caregiverId: 'caregiver-1',
          caregiverName: 'Emily Davis',
          caregiverPhoto: '/images/caregiver1.jpg',
          caregiverRating: 4.8,
          date: '2024-08-15',
          startTime: '18:00',
          endTime: '22:00',
          duration: 4,
          totalAmount: 120.00,
          status: 'upcoming',
          children: ['Emma Williams', 'Oliver Williams'],
          address: '123 Family Lane, Manhattan, NY 10001',
          notes: 'Bedtime at 8:30 PM for Emma, 9:00 PM for Oliver'
        },
        {
          id: 'booking-2',
          caregiverId: 'caregiver-2',
          caregiverName: 'Jennifer Chen',
          caregiverPhoto: '/images/caregiver2.jpg',
          caregiverRating: 4.9,
          date: '2024-08-10',
          startTime: '14:00',
          endTime: '18:00',
          duration: 4,
          totalAmount: 140.00,
          status: 'completed',
          children: ['Emma Williams'],
          address: '123 Family Lane, Manhattan, NY 10001',
          reviewGiven: true
        }
      ];

      // Add some initial sample notifications if this is a new user (moved to separate useEffect)

      setProfile(userProfile);
      // Use real bookings if available, otherwise use mock for empty state
      setBookings(bookingsData.length > 0 ? bookingsData : mockBookings);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updatedProfile: ParentProfile) => {
    try {
      // API call to update profile
      setProfile(updatedProfile);
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const addChild = async (childData: Child) => {
    try {
      // Send to API to save in database
      const response = await fetch('/api/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
  };

  const updateChild = async (childData: Child) => {
    try {
      // TODO: Implement child update API endpoint
      alert('Child profile editing is not yet implemented. You can create a new profile instead.');
      setShowChildProfile(false);
      setEditingChild(undefined);
    } catch (error) {
      console.error('Error updating child:', error);
    }
  };

  const handleSaveChild = (childData: Child) => {
    if (editingChild) {
      updateChild(childData);
    } else {
      addChild(childData);
    }
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setShowChildProfile(true);
  };

  const handleAddNewChild = () => {
    setEditingChild(undefined);
    setShowChildProfile(true);
  };

  const handleCancelChildProfile = () => {
    setShowChildProfile(false);
    setEditingChild(undefined);
  };


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
  const upcomingBookings = bookings.filter(b => b.status === 'upcoming').length;
  
  // Use real unread message count from chat rooms
  const unreadMessageCount = realUnreadMessageCount;

  // Review functions
  const handleLeaveReview = (booking: Booking) => {
    setReviewBooking(booking);
    setShowReviewForm(true);
  };


  const handleSubmitReview = async (reviewData: ReviewFormData) => {
    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      // Update booking to mark review as given
      setBookings(prev => prev.map(b => 
        b.id === reviewData.bookingId ? { ...b, reviewGiven: true } : b
      ));

      // Close form
      setShowReviewForm(false);
      setReviewBooking(null);

      // Show success notification
      addSystemNotification('Review Submitted', 'Your review has been submitted successfully and is pending approval.');

    } catch (error) {
      console.error('Error submitting review:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCloseReviewForm = () => {
    setShowReviewForm(false);
    setReviewBooking(null);
  };

  // Mark message notifications as read when messages tab is viewed
  const handleTabChange = (tab: 'overview' | 'profile' | 'bookings' | 'messages' | 'children' | 'notifications') => {
    setActiveTab(tab);
    
    if (tab === 'messages') {
      // Mark all unread message notifications as read
      const unreadMessageNotifications = notifications.filter(n => 
        !n.isRead && n.type === 'new_message'
      );
      
      unreadMessageNotifications.forEach(notification => {
        markNotificationAsRead(notification.id);
      });

      // Refresh real message count when opening messages tab
      refreshMessageCount();
    }
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
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Parent Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-6 w-6 text-gray-600 dark:text-gray-300 cursor-pointer hover:text-green-600 dark:hover:text-green-400" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {profile.profilePhoto ? (
                    <img 
                      src={profile.profilePhoto} 
                      alt="Profile" 
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
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <OverviewTab 
                profile={profile} 
                bookings={bookings} 
                notifications={notifications.filter(n => !n.read)} 
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
              />
            )}
            {activeTab === 'messages' && user && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow min-h-[600px] h-[calc(100vh-12rem)]">
                <OrganizedMessagesContainer 
                  userId={user.id} 
                  userType="parent"
                  onMessageRead={(count) => decrementMessageCount(count)}
                  onRefreshCount={refreshMessageCount}
                />
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
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  profile: ParentProfile;
  bookings: Booking[];
  notifications: any[];
}> = ({ profile, bookings, notifications }) => {
  const upcomingBookings = bookings.filter(b => b.status === 'upcoming');
  const totalSpent = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.totalAmount, 0);

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
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalSpent.toFixed(2)}</p>
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
                    <img 
                      src={booking.caregiverPhoto} 
                      alt={booking.caregiverName}
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
                      {new Date(booking.date).toLocaleDateString()} at {booking.startTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      ${booking.totalAmount.toFixed(2)}
                    </p>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                        {booking.caregiverRating}
                      </span>
                    </div>
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
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    setUploadingAvatar(true);
    
    try {
      const avatarFormData = new FormData();
      avatarFormData.append('avatar', file);
      
      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: avatarFormData,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, profilePhoto: data.avatarUrl }));
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
                  <img 
                    src={formData.profilePhoto} 
                    alt="Profile" 
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
}> = ({ bookings, handleTabChange, handleLeaveReview }) => {
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h2>
          
          {/* Filter Buttons */}
          <div className="flex space-x-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
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
              <div key={booking.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex space-x-4">
                    {/* Caregiver Photo */}
                    <div className="flex-shrink-0">
                      {booking.caregiverPhoto ? (
                        <img 
                          src={booking.caregiverPhoto} 
                          alt={booking.caregiverName}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Booking Details */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {booking.caregiverName}
                        </h3>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">
                            {booking.caregiverRating}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="ml-1 capitalize">{booking.status}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(booking.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
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
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      ${booking.totalAmount.toFixed(2)}
                    </div>
                    
                    <div className="space-y-2">
                      {booking.status === 'completed' && !booking.reviewGiven && (
                        <button 
                          onClick={() => handleLeaveReview(booking)}
                          className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-lg transition-colors"
                        >
                          Leave Review
                        </button>
                      )}
                      
                      {(booking.status === 'upcoming' || booking.status === 'ongoing') && (
                        <>
                          <button 
                            onClick={() => handleTabChange('messages')}
                            className="w-full px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                          >
                            Message Caregiver
                          </button>
                          {booking.status === 'upcoming' && (
                            <button className="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                              Cancel Booking
                            </button>
                          )}
                        </>
                      )}
                      
                      {booking.status === 'completed' && (
                        <button className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
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

  const totalChildren = childrenData.length;
  const totalAllergies = childrenData.reduce((sum, child) => sum + child.allergies.length, 0);
  const severeAllergies = childrenData.reduce((sum, child) => sum + child.allergies.filter(a => a.severity === 'Severe').length, 0);
  const totalMedications = childrenData.reduce((sum, child) => sum + child.medications.length, 0);
  const childrenWithEmergencyInfo = childrenData.filter(child => child.emergencyMedicalInfo).length;

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
        <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white p-6 rounded-lg shadow-xl dark:shadow-2xl border-4 border-red-300 dark:border-red-400 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="text-4xl animate-bounce">🚨</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">CRITICAL SAFETY ALERT</h3>
              <p className="font-medium">
                {severeAllergies > 0 && `${severeAllergies} child(ren) have SEVERE allergies requiring immediate attention. `}
                {childrenWithEmergencyInfo > 0 && `${childrenWithEmergencyInfo} child(ren) have emergency medical conditions. `}
                Ensure all caregivers are fully briefed before any childcare session.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold uppercase tracking-wider">IMMEDIATE</p>
              <p className="text-sm font-bold uppercase tracking-wider">ATTENTION</p>
              <p className="text-sm font-bold uppercase tracking-wider">REQUIRED</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Children</h2>
          <button
            onClick={onAddChild}
            className="inline-flex items-center px-4 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
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
              <div key={child.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6 hover:shadow-md dark:hover:shadow-lg transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex space-x-4">
                    <div className="flex-shrink-0">
                      {child.photoUrl ? (
                        <img 
                          src={child.photoUrl} 
                          alt={`${child.firstName} ${child.lastName}`}
                          className="h-16 w-16 rounded-full object-cover ring-2 ring-purple-200 dark:ring-purple-700"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center ring-2 ring-purple-200 dark:ring-purple-700">
                          <Baby className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {child.firstName} {child.lastName}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ageGroup.color}`}>
                          {age} years old • {ageGroup.label}
                        </span>
                        {child.gender && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {child.gender}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300 mb-3">
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
                      <div className="mt-4 p-4 bg-gradient-to-r from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 text-white rounded-lg shadow-lg dark:shadow-xl">
                        <h4 className="font-bold text-sm uppercase tracking-wide mb-3 flex items-center">
                          <span className="mr-2">🏥</span>
                          MEDICAL QUICK REFERENCE
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
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
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center">
                          <span className="mr-2">✅</span>
                          CAREGIVER SAFETY CHECKLIST
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
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
                  <div className="text-right">
                    <div className="space-y-2">
                      <button
                        onClick={() => onEditChild(child)}
                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4 mr-2 inline" />
                        Edit Profile
                      </button>
                      
                      {/* Quick Stats */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div>👥 {child.emergencyContacts?.length || 0} emergency contacts</div>
                        {child.allergies.length > 0 && (
                          <div>⚠️ {child.allergies.length} allergies</div>
                        )}
                        {child.medications.length > 0 && (
                          <div>💊 {child.medications.length} medications</div>
                        )}
                      </div>
                    </div>
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
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
      case 'booking': return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'caregiver': return <User className="h-5 w-5 text-green-600" />;
      case 'payment': return <CreditCard className="h-5 w-5 text-indigo-600" />;
      case 'system': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default: return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const markAllAsReadHandler = async () => {
    onMarkAllAsRead();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount} unread
              </span>
            )}
          </h2>
          
          <div className="flex space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsReadHandler}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
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
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    ? 'bg-white border-gray-200 hover:shadow-sm' 
                    : 'bg-blue-50 border-blue-200 hover:shadow-md'
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
                        <p className={`text-sm font-medium ${notification.read ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-1 ${notification.read ? 'text-gray-600' : 'text-gray-700'}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
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
                            className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-full"
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
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-600">
                {filter === 'all' 
                  ? "You're all caught up!"
                  : `No ${filter} notifications.`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Booking Notifications</h4>
              <p className="text-sm text-gray-600">Get notified about booking confirmations and updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Caregiver Messages</h4>
              <p className="text-sm text-gray-600">Get notified when caregivers send you messages</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Payment Notifications</h4>
              <p className="text-sm text-gray-600">Get notified about payment confirmations and receipts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
              <p className="text-sm text-gray-600">Receive notifications via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
              <p className="text-sm text-gray-600">Receive notifications via text message</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
            Save Settings
          </button>
        </div>
      </div>
      
      {/* Real-world Browser Notification Settings */}
      <NotificationSettings />
      
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

export default ParentDashboard;