'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useSession, signOut } from 'next-auth/react';

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  province?: string; // Canadian terminology
  zipCode?: string;
  postalCode?: string; // Canadian terminology
  country?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export interface CaregiverData {
  id: string;
  hourlyRate?: number;
  averageRating?: number;
  isAvailable?: boolean;
  bio?: string;
  specialties?: string[];
  experienceYears?: number;
  stripeAccountId?: string;
  location?: any;
}

export interface AuthUser {
  id: string;
  email: string;
  userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
  approvalStatus: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  profile: UserProfile | null;
  caregiver: CaregiverData | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, userType?: 'parent' | 'caregiver', rememberMe?: boolean) => Promise<{ success: boolean; error?: string; status?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isParent: boolean;
  isCaregiver: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Fetch current user data
  const fetchUser = async (): Promise<void> => {
    try {
      // Use JWT token authentication directly (skip NextAuth session check)
      console.log('fetchUser: Starting JWT-based user fetch');
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
      const cookieToken = Cookies.get('auth-token');
      const token = localToken || cookieToken;
      
      console.log('fetchUser token sources:', { localToken: !!localToken, cookieToken: !!cookieToken, hasToken: !!token });
      
      const headers: HeadersInit = {};
      if (token) {
        headers['x-auth-token'] = token;
        headers['authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      console.log('fetchUser response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('fetchUser success:', data);
        setUser(data.user);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.log('fetchUser error:', response.status, errorData);
        console.log('Current tokens when fetch failed:', {
          localStorage: typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null,
          cookies: Cookies.get('auth-token')
        });
        // Don't clear session immediately on error - could be temporary
        // Only clear if it's clearly an auth error (401/403)
        if (response.status === 401 || response.status === 403) {
          console.log('Clearing invalid session due to 401/403');
          setUser(null);
          Cookies.remove('auth-token');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-token');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      setUser(null);
      Cookies.remove('auth-token');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-token');
      }
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (
    email: string, 
    password: string, 
    userType?: 'parent' | 'caregiver',
    rememberMe: boolean = false
  ): Promise<{ success: boolean; error?: string; status?: string }> => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, userType, rememberMe }),
      });

      const data = await response.json();
      console.log('Login response:', { status: response.status, data });

      if (response.ok) {
        console.log('Login successful, setting user:', data.user);
        setUser(data.user);
        
        // Store token in multiple places for reliability
        if (data.token) {
          console.log('Storing auth token');
          // localStorage fallback
          localStorage.setItem('auth-token', data.token);
          // js-cookie fallback (non-httpOnly)
          Cookies.set('auth-token', data.token, { 
            expires: rememberMe ? 30 : 7,
            path: '/',
            sameSite: 'lax'
          });
        }
        
        // Force a user fetch to ensure session is properly established
        setTimeout(() => {
          console.log('Fetching user after login to ensure session');
          fetchUser();
        }, 100);
        
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { 
          success: false, 
          error: data.error || 'Login failed',
          status: data.status
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      return { 
        success: false, 
        error: 'Network error during login' 
      };
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Clear local state immediately for faster UX
      setUser(null);
      Cookies.remove('auth-token');
      
      // Also clear localStorage fallback
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-token');
      }
      
      // Check if user is logged in via NextAuth (Google OAuth)
      if (session) {
        // Sign out from NextAuth
        await signOut({ redirect: false });
      } else {
        // Make API call to clear JWT session
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const logoutPromise = fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
        
        // Handle API call in background
        logoutPromise.catch(error => {
          if (error.name === 'AbortError') {
            console.log('Logout API call timed out (non-critical)');
          } else {
            console.error('Logout API call failed (non-critical):', error);
          }
        });
      }
      
      // Redirect to home
      router.push('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure logout happens even if there's an error
      setUser(null);
      Cookies.remove('auth-token');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    if (user) {
      await fetchUser();
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    fetchUser();
  }, []);
  
  // Sync with NextAuth session changes
  useEffect(() => {
    if (sessionStatus === 'loading') return; // Still loading
    
    if (sessionStatus === 'authenticated' && session?.user && !user) {
      // NextAuth session exists but our user state doesn't, fetch user data
      fetchUser();
    } else if (sessionStatus === 'unauthenticated' && user) {
      // NextAuth session is gone but we still have user state, clear it
      setUser(null);
      setLoading(false);
    }
  }, [session, sessionStatus, user]);

  // Helper computed values
  const isAuthenticated = !!user;
  const isParent = user?.userType === 'PARENT';
  const isCaregiver = user?.userType === 'CAREGIVER';
  const isAdmin = user?.userType === 'ADMIN';

  const contextValue: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated,
    isParent,
    isCaregiver,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}