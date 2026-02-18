import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketSafe } from '@/context/SocketContext';

interface BookingUnreadCounts {
  [bookingId: string]: number;
}

export const useBookingUnreadCounts = () => {
  const { user } = useAuth();
  const { onUnreadCountUpdate, isConnected } = useSocketSafe();
  const [unreadCounts, setUnreadCounts] = useState<BookingUnreadCounts>({});
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadCounts({});
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/chat/rooms');

      if (response.ok) {
        const result = await response.json();
        const rooms = Array.isArray(result) ? result : (result.success ? result.data : []);

        // Create a map of booking ID to unread count
        const counts: BookingUnreadCounts = {};
        rooms.forEach((room: any) => {
          if (room.booking?.id) {
            counts[room.booking.id] = room.unreadCount || 0;
          }
        });

        setUnreadCounts(counts);
      } else if (response.status === 401 || response.status === 403) {
        // User not authenticated - this is expected, silently reset counts
        setUnreadCounts({});
      } else {
        console.error('Failed to fetch booking unread counts:', response.status);
        setUnreadCounts({});
      }
    } catch (error) {
      console.error('Error fetching booking unread counts:', error);
      setUnreadCounts({});
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshCounts = useCallback(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  const decrementCountForBooking = useCallback((bookingId: string, amount: number = 1) => {
    setUnreadCounts(prev => ({
      ...prev,
      [bookingId]: Math.max(0, (prev[bookingId] || 0) - amount)
    }));
  }, []);

  const clearCountForBooking = useCallback((bookingId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [bookingId]: 0
    }));
  }, []);

  const getCountForBooking = useCallback((bookingId: string): number => {
    return unreadCounts[bookingId] || 0;
  }, [unreadCounts]);

  const getTotalUnreadCount = useCallback((): number => {
    return Object.values(unreadCounts).reduce((total, count) => total + count, 0);
  }, [unreadCounts]);

  // Subscribe to real-time unread count updates via WebSocket
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onUnreadCountUpdate((data) => {
      console.log('[useBookingUnreadCounts] Real-time update received:', data);
      setUnreadCounts(prev => ({
        ...prev,
        [data.bookingId]: data.unreadCount
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, onUnreadCountUpdate]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  return {
    unreadCounts,
    loading,
    refreshCounts,
    decrementCountForBooking,
    clearCountForBooking,
    getCountForBooking,
    getTotalUnreadCount,
  };
};
