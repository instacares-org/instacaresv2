import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const userType = user.userType === 'PARENT' ? 'parent' : 'caregiver';
      const response = await fetch(`/api/chat/rooms?userId=${user.id}&userType=${userType}`);
      
      if (response.ok) {
        const result = await response.json();
        const rooms = Array.isArray(result) ? result : (result.success ? result.data : []);
        
        // Calculate total unread messages across all rooms
        const totalUnread = rooms.reduce((total: number, room: any) => {
          return total + (room.unreadCount || 0);
        }, 0);
        
        setUnreadCount(totalUnread);
      } else {
        console.error('Failed to fetch unread message count');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread message count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshCount = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const decrementCount = useCallback((amount: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - amount));
  }, []);

  const incrementCount = useCallback((amount: number = 1) => {
    setUnreadCount(prev => prev + amount);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refreshCount,
    decrementCount,
    incrementCount,
  };
};