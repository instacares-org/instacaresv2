import { useState, useEffect, useCallback } from 'react';
import { caregiversAPI, tokenManager } from '../services/api';

interface Caregiver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  bio?: string;
  hourlyRate: number;
  experienceYears: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  backgroundCheck: boolean;
  profilePicture?: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  availability: any[];
  specialties: string[];
  certifications: string[];
  languages: string[];
  distance?: string;
  isOnline?: boolean;
}

interface UseCaregiversState {
  caregivers: Caregiver[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

interface UseCaregiversFilters {
  available?: boolean;
  verified?: boolean;
  minRating?: number;
  maxPrice?: number;
  location?: string;
  specialty?: string;
  page?: number;
  limit?: number;
}

export const useCaregivers = (filters?: UseCaregiversFilters) => {
  const [state, setState] = useState<UseCaregiversState>({
    caregivers: [],
    isLoading: true,
    error: null,
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
  });

  const [currentFilters, setCurrentFilters] = useState(filters || {});

  useEffect(() => {
    fetchCaregivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters]);

  const fetchCaregivers = useCallback(async () => {
    console.log('🔄 Fetching caregivers with filters:', currentFilters);
    
    // Check if user is authenticated first - caregivers can be viewed without auth
    const token = await tokenManager.getToken();
    console.log('🔐 Auth token available:', !!token);
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await caregiversAPI.getAll(currentFilters);
      console.log('📦 Raw API response:', response);
      
      // Handle different possible response structures from the API
      let caregiversData = [];
      
      if (response.caregivers) {
        caregiversData = response.caregivers;
      } else if (response.data) {
        caregiversData = response.data;
      } else if (Array.isArray(response)) {
        caregiversData = response;
      } else {
        console.warn('⚠️ Unexpected API response structure:', response);
        caregiversData = [];
      }
      
      console.log('👥 Processing caregivers data:', caregiversData);
      
      // Transform the response to match our interface
      const transformedCaregivers = caregiversData.map((caregiver: any) => {
        console.log('🔄 Transforming caregiver:', caregiver);
        
        return {
          id: caregiver.id || caregiver.userId || '',
          userId: caregiver.userId || caregiver.id || '',
          name: caregiver.name || caregiver.user?.name || 'Unknown',
          email: caregiver.email || caregiver.user?.email || '',
          phone: caregiver.phone || caregiver.user?.phone || '',
          bio: caregiver.bio || '',
          hourlyRate: parseFloat(caregiver.hourlyRate) || 0,
          experienceYears: parseInt(caregiver.experienceYears) || 0,
          rating: parseFloat(caregiver.averageRating || caregiver.rating) || 0,
          reviewCount: parseInt(caregiver.totalBookings || caregiver.reviewCount) || 0,
          verified: Boolean(caregiver.isVerified || caregiver.verified),
          backgroundCheck: Boolean(caregiver.backgroundCheck),
          profilePicture: caregiver.profilePhoto || caregiver.profilePicture || caregiver.image || caregiver.user?.profilePicture,
          specialties: caregiver.services?.map((s: any) => s.type || s.name || s) || caregiver.specialties || [],
          certifications: caregiver.certifications || [],
          languages: caregiver.languages || ['English'],
          availability: caregiver.availability || [],
          location: caregiver.address ? {
            address: caregiver.address.street || caregiver.address.address || '',
            city: caregiver.address.city || '',
            state: caregiver.address.province || caregiver.address.state || '',
            zipCode: caregiver.address.postalCode || caregiver.address.zipCode || '',
            coordinates: caregiver.address.latitude ? {
              lat: parseFloat(caregiver.address.latitude),
              lng: parseFloat(caregiver.address.longitude)
            } : undefined
          } : {
            address: '',
            city: '',
            state: '',
            zipCode: '',
          },
          isOnline: false, // Will be updated via socket
        };
      });

      console.log('✅ Transformed caregivers:', transformedCaregivers);

      setState({
        caregivers: transformedCaregivers,
        isLoading: false,
        error: null,
        totalCount: response.total || response.pagination?.total || transformedCaregivers.length,
        currentPage: response.currentPage || response.pagination?.currentPage || 1,
        totalPages: Math.ceil((response.total || response.pagination?.total || transformedCaregivers.length) / (response.limit || response.pagination?.limit || 20)),
      });
    } catch (error: any) {
      console.error('❌ Failed to fetch caregivers:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load caregivers',
      }));
    }
  }, [currentFilters]);

  const updateFilters = useCallback((newFilters: UseCaregiversFilters) => {
    setCurrentFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setCurrentFilters({});
  }, []);

  const refreshCaregivers = useCallback(() => {
    fetchCaregivers();
  }, [fetchCaregivers]);

  const getCaregiverById = useCallback(async (id: string) => {
    try {
      const caregiver = await caregiversAPI.getById(id);
      return caregiver;
    } catch (error) {
      console.error('Failed to fetch caregiver:', error);
      throw error;
    }
  }, []);

  return {
    caregivers: state.caregivers,
    isLoading: state.isLoading,
    error: state.error,
    totalCount: state.totalCount,
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    updateFilters,
    resetFilters,
    refreshCaregivers,
    getCaregiverById,
  };
};

// Hook for featured caregivers
export const useFeaturedCaregivers = () => {
  return useCaregivers({
    verified: true,
    minRating: 4.5,
    limit: 10,
  });
};

// Hook for nearby caregivers
export const useNearbyCaregivers = (location?: string) => {
  return useCaregivers({
    location,
    available: true,
    limit: 20,
  });
};