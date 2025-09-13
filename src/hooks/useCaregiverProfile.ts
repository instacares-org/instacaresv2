import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useCaregiverProfile() {
  const { user, loading: authLoading } = useAuth();
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCaregiverProfile() {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // If not a caregiver, don't fetch
      if (!user?.id || user.userType !== 'CAREGIVER') {
        setLoading(false);
        setError(user?.id ? 'User is not a caregiver' : 'No authenticated user');
        return;
      }

      try {
        console.log('Fetching caregiver profile for user:', user.id, user.userType);
        const response = await fetch('/api/caregiver/profile', {
          credentials: 'include', // Include cookies
          headers: {
            'Content-Type': 'application/json',
          }
        });

        console.log('Caregiver profile response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Caregiver profile data:', data);

          if (data.success && data.caregiver?.id) {
            setCaregiverId(data.caregiver.id);
            setError(null);
          } else {
            setError('No caregiver profile found');
          }
        } else {
          const errorData = await response.text();
          console.error('Caregiver profile API error:', response.status, errorData);
          setError(`API error: ${response.status} ${errorData}`);
        }
      } catch (error) {
        console.error('Failed to fetch caregiver profile:', error);
        setError(`Network error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchCaregiverProfile();
  }, [user, authLoading]);

  return { caregiverId, loading, error };
}