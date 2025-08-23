import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useCaregiverProfile() {
  const { user } = useAuth();
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCaregiverProfile() {
      if (!user?.id || user.userType !== 'CAREGIVER') {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/caregiver/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.caregiver?.id) {
            setCaregiverId(data.caregiver.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch caregiver profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCaregiverProfile();
  }, [user]);

  return { caregiverId, loading };
}