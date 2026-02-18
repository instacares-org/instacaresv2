import { useState, useEffect } from 'react';

export function useUserTimezone() {
  const [timezone, setTimezone] = useState<string>('America/Toronto'); // Default fallback
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserTimezone() {
      try {
        // Try to get timezone from session
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (data.user?.profile?.timezone) {
          setTimezone(data.user.profile.timezone);
        } else {
          // Fallback: Try to detect browser timezone
          try {
            const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (browserTz) {
              setTimezone(browserTz);
            }
          } catch (error) {
            console.warn('Could not detect browser timezone:', error);
            // Keep default: America/Toronto
          }
        }
      } catch (error) {
        console.warn('Could not fetch user timezone:', error);
        // Fallback: Try browser detection
        try {
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (browserTz) {
            setTimezone(browserTz);
          }
        } catch (e) {
          // Keep default: America/Toronto
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUserTimezone();
  }, []);

  return { timezone, loading };
}
