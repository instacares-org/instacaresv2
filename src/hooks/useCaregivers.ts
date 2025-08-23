import { useState, useEffect } from 'react';

interface CaregiverSearchParams {
  latitude?: number;
  longitude?: number;
  serviceType?: string;
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  limit?: number;
  offset?: number;
}

interface Caregiver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  hourlyRate: number;
  experienceYears: number;
  bio?: string;
  languages: string[];
  maxChildren: number;
  minAge: number;
  maxAge: number;
  isVerified: boolean;
  backgroundCheck: boolean;
  totalBookings: number;
  averageRating?: number;
  profilePhoto?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  services: Array<{
    type: string;
    rate: number;
    description?: string;
  }>;
  lastActiveAt: string;
  createdAt: string;
}

interface CaregiverResponse {
  success: boolean;
  data: Caregiver[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
  message?: string;
}

export function useCaregivers(params: CaregiverSearchParams = {}) {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchCaregivers = async (searchParams: CaregiverSearchParams = {}) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      
      // Add search parameters
      if (searchParams.latitude) queryParams.append('lat', searchParams.latitude.toString());
      if (searchParams.longitude) queryParams.append('lng', searchParams.longitude.toString());
      if (searchParams.serviceType) queryParams.append('serviceType', searchParams.serviceType);
      if (searchParams.minRate) queryParams.append('minRate', searchParams.minRate.toString());
      if (searchParams.maxRate) queryParams.append('maxRate', searchParams.maxRate.toString());
      if (searchParams.minRating) queryParams.append('minRating', searchParams.minRating.toString());
      if (searchParams.limit) queryParams.append('limit', searchParams.limit.toString());
      if (searchParams.offset) queryParams.append('offset', searchParams.offset.toString());

      const response = await fetch(`/api/caregivers?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: CaregiverResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || result.error || 'Failed to fetch caregivers');
      }

      setCaregivers(result.data);
      setHasMore(result.pagination.hasMore);
      
    } catch (err) {
      console.error('Error fetching caregivers:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      // Fallback to empty array
      setCaregivers([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;

    const newParams = {
      ...params,
      offset: caregivers.length,
    };

    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      if (newParams.latitude) queryParams.append('lat', newParams.latitude.toString());
      if (newParams.longitude) queryParams.append('lng', newParams.longitude.toString());
      if (newParams.serviceType) queryParams.append('serviceType', newParams.serviceType);
      if (newParams.minRate) queryParams.append('minRate', newParams.minRate.toString());
      if (newParams.maxRate) queryParams.append('maxRate', newParams.maxRate.toString());
      if (newParams.minRating) queryParams.append('minRating', newParams.minRating.toString());
      if (newParams.limit) queryParams.append('limit', newParams.limit.toString());
      if (newParams.offset) queryParams.append('offset', newParams.offset.toString());

      const response = await fetch(`/api/caregivers?${queryParams.toString()}`);
      const result: CaregiverResponse = await response.json();
      
      if (result.success) {
        setCaregivers(prev => [...prev, ...result.data]);
        setHasMore(result.pagination.hasMore);
      }
    } catch (err) {
      console.error('Error loading more caregivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchCaregivers(params);
  };

  useEffect(() => {
    fetchCaregivers(params);
  }, [
    params.latitude,
    params.longitude,
    params.serviceType,
    params.minRate,
    params.maxRate,
    params.minRating,
    params.limit,
  ]);

  return {
    caregivers,
    loading,
    error,
    hasMore,
    fetchCaregivers,
    loadMore,
    refresh,
  };
}

export function useCaregiver(id: string) {
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchCaregiver = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/caregivers/${id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || result.error || 'Failed to fetch caregiver');
        }

        setCaregiver(result.data);
        
      } catch (err) {
        console.error('Error fetching caregiver:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setCaregiver(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCaregiver();
  }, [id]);

  return {
    caregiver,
    loading,
    error,
  };
}