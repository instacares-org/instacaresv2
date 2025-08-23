import { useState, useEffect, useCallback } from 'react';

export interface AvailabilitySlot {
  id: string;
  caregiverId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCapacity: number;
  currentOccupancy: number;
  availableSpots: number;
  realTimeAvailable?: number;
  baseRate: number;
  currentRate: number;
  status: string;
  caregiver?: {
    user: {
      profile: {
        firstName: string;
        lastName: string;
      };
    };
  };
}

export interface RealtimeAvailability {
  caregiverId: string;
  date: string;
  slots: AvailabilitySlot[];
  totalSlotsAvailable: number;
  totalSpotsAvailable: number;
}

export interface BookingReservation {
  id: string;
  slotId: string;
  parentId: string;
  childrenCount: number;
  reservedSpots: number;
  status: string;
  expiresAt: string;
}

export function useAvailability() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get available slots
  const getAvailableSlots = useCallback(async (params: {
    caregiverId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    minAvailableSpots?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const response = await fetch(`/api/availability/slots?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch availability');
      }

      return data.data as AvailabilitySlot[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch availability';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get real-time availability for a specific caregiver and date
  const getRealTimeAvailability = useCallback(async (caregiverId: string, date: string) => {
    setLoading(true);
    setError(null);

    console.log('🔍 useAvailability - fetching realtime availability:', { caregiverId, date });

    try {
      const response = await fetch(
        `/api/availability/realtime?caregiverId=${caregiverId}&date=${date}`
      );
      const data = await response.json();

      console.log('🔍 useAvailability - realtime API response:', data);
  console.log('🔍 API returned slots:', data.data?.slots?.length || 0, 'for date:', date, 'caregiver:', caregiverId);

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch real-time availability');
      }

      return data.data as RealtimeAvailability;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch real-time availability';
      console.error('🔍 useAvailability - realtime API error:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reserve spots temporarily
  const reserveSpots = useCallback(async (params: {
    slotId: string;
    childrenCount: number;
    reservedSpots: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/availability/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reserve spots');
      }

      return data.data as BookingReservation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reserve spots';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel reservation
  const cancelReservation = useCallback(async (reservationId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/availability/reserve?reservationId=${reservationId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel reservation');
      }

      return data.data as BookingReservation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel reservation';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create availability slot (for caregivers)
  const createSlot = useCallback(async (params: {
    date: string;
    startTime: string;
    endTime: string;
    totalCapacity?: number;
    baseRate?: number;
    isRecurring?: boolean;
    recurringPattern?: any;
    specialRequirements?: any;
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);

    console.log('createSlot called with params:', params);

    try {
      const response = await fetch('/api/availability/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      console.log('API response status:', response.status);
      console.log('API response ok:', response.ok);

      const data = await response.json();
      console.log('API response data:', data);

      if (!data.success) {
        console.error('API returned error:', data.error);
        throw new Error(data.error || 'Failed to create availability slot');
      }

      return data.data as AvailabilitySlot;
    } catch (err) {
      console.error('Error in createSlot:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create availability slot';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update availability slot (for caregivers)
  const updateSlot = useCallback(async (slotId: string, params: {
    date?: string;
    startTime?: string;
    endTime?: string;
    totalCapacity?: number;
    baseRate?: number;
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/availability/slots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId,
          ...params
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update availability slot');
      }

      return data.data as AvailabilitySlot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update availability slot';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete availability slot (for caregivers)
  const deleteSlot = useCallback(async (slotId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/availability/slots?slotId=${slotId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete availability slot');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete availability slot';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getAvailableSlots,
    getRealTimeAvailability,
    reserveSpots,
    cancelReservation,
    createSlot,
    updateSlot,
    deleteSlot,
  };
}

// Hook for live availability updates (could be enhanced with WebSocket later)
export function useLiveAvailability(caregiverId: string, date: string, intervalMs: number = 30000) {
  const [availability, setAvailability] = useState<RealtimeAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getRealTimeAvailability } = useAvailability();

  const updateAvailability = useCallback(async () => {
    try {
      setError(null);
      const data = await getRealTimeAvailability(caregiverId, date);
      setAvailability(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability');
    } finally {
      setLoading(false);
    }
  }, [caregiverId, date, getRealTimeAvailability]);

  useEffect(() => {
    if (!caregiverId || !date) return;

    // Initial load
    updateAvailability();

    // Set up periodic updates
    const interval = setInterval(updateAvailability, intervalMs);

    return () => clearInterval(interval);
  }, [caregiverId, date, intervalMs, updateAvailability]);

  return {
    availability,
    loading,
    error,
    refresh: updateAvailability
  };
}