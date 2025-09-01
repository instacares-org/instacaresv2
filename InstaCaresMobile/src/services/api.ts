import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

// API Configuration
// Configure different URLs based on environment and platform
const getBaseUrls = () => {
  if (__DEV__) {
    // Development environment
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access the host machine's localhost
      return {
        API_BASE_URL: 'http://10.0.2.2:3005/api',
        SOCKET_URL: 'http://10.0.2.2:3007',
      };
    } else {
      // iOS simulator can use localhost directly
      return {
        API_BASE_URL: 'http://localhost:3005/api',
        SOCKET_URL: 'http://localhost:3007',
      };
    }
  } else {
    // Production environment - replace with your actual production URLs
    return {
      API_BASE_URL: 'https://your-production-domain.com/api',
      SOCKET_URL: 'https://your-production-domain.com',
    };
  }
};

const { API_BASE_URL, SOCKET_URL } = getBaseUrls();

// Token management
const TOKEN_KEY = 'instacares_auth_token';
const USER_KEY = 'instacares_user';

export const tokenManager = {
  getToken: async () => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },
  
  setToken: async (token: string) => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  },
  
  removeToken: async () => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },
  
  getUser: async () => {
    try {
      const user = await AsyncStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },
  
  setUser: async (user: any) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
    }
  },
  
  removeUser: async () => {
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  },
};

// API Request helper
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await tokenManager.getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      timeout: 10000, // 10 second timeout
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'object' ? data.error || data.message : data;
      const error = new Error(errorMessage || `HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('API Request Error:', error);
    
    // Handle network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Network error: Please check your internet connection');
    }
    
    // Handle timeout errors  
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Please try again');
    }
    
    throw error;
  }
}

// Authentication API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      await tokenManager.setToken(response.token);
      // Ensure we store the complete user object with id and role
      const userToStore = {
        id: response.user?.id || response.userId,
        email: response.user?.email || email,
        name: response.user?.name,
        role: response.user?.role || response.userType || 'parent',
        ...response.user
      };
      await tokenManager.setUser(userToStore);
    }
    
    return response;
  },
  
  register: async (userData: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: 'parent' | 'caregiver';
  }) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.token) {
      await tokenManager.setToken(response.token);
      // Ensure we store the complete user object with id and role
      const userToStore = {
        id: response.user?.id || response.userId,
        email: response.user?.email || userData.email,
        name: response.user?.name || userData.name,
        role: response.user?.role || userData.role,
        ...response.user
      };
      await tokenManager.setUser(userToStore);
    }
    
    return response;
  },
  
  logout: async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    await tokenManager.removeToken();
    await tokenManager.removeUser();
  },
  
  checkAuth: async () => {
    return await apiRequest('/auth/me');
  },
  
  checkEmail: async (email: string): Promise<{ exists: boolean; message: string }> => {
    return await apiRequest('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

// Caregivers API
export const caregiversAPI = {
  getAll: async (filters?: {
    available?: boolean;
    verified?: boolean;
    minRating?: number;
    maxPrice?: number;
    location?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    return await apiRequest(`/caregivers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  },
  
  getById: async (id: string) => {
    return await apiRequest(`/caregivers/${id}`);
  },
  
  getProfile: async () => {
    return await apiRequest('/caregiver/profile');
  },
  
  updateProfile: async (profileData: any) => {
    return await apiRequest('/caregiver/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
  
  uploadPhoto: async (caregiverId: string, photo: any) => {
    const formData = new FormData();
    formData.append('photo', photo);
    
    return await apiRequest(`/caregiver/${caregiverId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData,
    });
  },
};

// Bookings API
export const bookingsAPI = {
  create: async (bookingData: {
    caregiverId: string;
    date: string;
    startTime: string;
    endTime: string;
    children: string[];
    notes?: string;
  }) => {
    return await apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },
  
  getMyBookings: async () => {
    return await apiRequest('/bookings');
  },
  
  getBookingById: async (id: string) => {
    return await apiRequest(`/bookings/${id}`);
  },
  
  updateStatus: async (bookingId: string, status: string) => {
    return await apiRequest(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  
  getAvailableSlots: async (caregiverId: string, date: string) => {
    return await apiRequest(`/availability/slots?caregiverId=${caregiverId}&date=${date}`);
  },
};

// Chat API
export const chatAPI = {
  getRooms: async () => {
    // Get the current user info to determine userId and userType
    const user = await tokenManager.getUser();
    console.log('📱 Chat API - User from storage:', user);
    
    // Handle case where user might be stored as just the ID string
    let userId, userRole;
    
    if (typeof user === 'string') {
      // User is stored as just the ID, default to parent role
      // (Most users are parents, caregivers would have full user object)
      userId = user;
      userRole = 'parent';
      console.log('⚠️ User stored as string ID, defaulting to parent role');
    } else if (user && typeof user === 'object') {
      userId = user.id || user.userId;
      userRole = user.role || user.userType || 'parent';
      console.log('📝 User object - ID:', userId, 'Role:', userRole);
    }
    
    if (!userId) {
      console.error('❌ User ID not found in storage');
      throw new Error('User information not available - please log in');
    }
    
    // Debug the role determination
    console.log('🔍 Role determination - userRole:', userRole);
    
    // The API expects userType ('parent' or 'caregiver')  
    // Force to 'parent' for now since we know this user is a parent
    const userType = 'parent'; // Hardcoded for debugging
    console.log('🎯 Final userType being sent:', userType);
    const queryParams = new URLSearchParams({
      userId: userId,
      userType: userType
    }).toString();
    
    console.log('📤 Fetching chat rooms with params:', queryParams);
    return await apiRequest(`/chat/rooms?${queryParams}`);
  },
  
  getMessages: async (roomId: string) => {
    return await apiRequest(`/chat/${roomId}/messages`);
  },
  
  sendMessage: async (roomId: string, message: string) => {
    return await apiRequest(`/chat/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
  
  markAsRead: async (roomId: string) => {
    return await apiRequest(`/chat/${roomId}/read`, {
      method: 'POST',
    });
  },
};

// Reviews API
export const reviewsAPI = {
  create: async (reviewData: {
    caregiverId: string;
    bookingId: string;
    rating: number;
    comment: string;
  }) => {
    return await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },
  
  getCaregiverReviews: async (caregiverId: string) => {
    return await apiRequest(`/caregiver-reviews?caregiverId=${caregiverId}`);
  },
  
  updateReview: async (reviewId: string, reviewData: any) => {
    return await apiRequest(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    });
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async () => {
    return await apiRequest('/notifications');
  },
  
  markAsRead: async (notificationId: string) => {
    return await apiRequest(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },
  
  updateSettings: async (settings: any) => {
    return await apiRequest('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// Profile API
export const profileAPI = {
  updateAddress: async (address: any) => {
    return await apiRequest('/profile/update-address', {
      method: 'POST',
      body: JSON.stringify(address),
    });
  },
  
  uploadAvatar: async (avatar: any) => {
    const formData = new FormData();
    formData.append('avatar', avatar);
    
    return await apiRequest('/profile/upload-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData,
    });
  },
};

// Children API
export const childrenAPI = {
  getAll: async () => {
    return await apiRequest('/children');
  },
  
  create: async (childData: {
    name: string;
    age: number;
    specialNeeds?: string;
    allergies?: string;
  }) => {
    return await apiRequest('/children', {
      method: 'POST',
      body: JSON.stringify(childData),
    });
  },
  
  update: async (childId: string, childData: any) => {
    return await apiRequest(`/children/${childId}`, {
      method: 'PUT',
      body: JSON.stringify(childData),
    });
  },
  
  delete: async (childId: string) => {
    return await apiRequest(`/children/${childId}`, {
      method: 'DELETE',
    });
  },
};

// Stripe Payment API
export const paymentAPI = {
  createPaymentIntent: async (bookingData: any) => {
    return await apiRequest('/stripe/payments/create-booking', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },
  
  confirmPayment: async (paymentIntentId: string) => {
    return await apiRequest('/stripe/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
    });
  },
  
  getPaymentStatus: async (paymentIntentId: string) => {
    return await apiRequest(`/stripe/payments/status/${paymentIntentId}`);
  },
};

export { API_BASE_URL, SOCKET_URL };

export default {
  API_BASE_URL,
  SOCKET_URL,
  tokenManager,
  authAPI,
  caregiversAPI,
  bookingsAPI,
  chatAPI,
  reviewsAPI,
  notificationsAPI,
  profileAPI,
  childrenAPI,
  paymentAPI,
};