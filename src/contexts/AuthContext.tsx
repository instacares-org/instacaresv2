'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { addCSRFHeader } from '@/lib/csrf';

interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string;
  userType?: 'PARENT' | 'CAREGIVER' | 'BABYSITTER' | 'ADMIN';
  approvalStatus?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLogin?: string;
  createdAt?: string;
  needsProfileCompletion?: boolean;
  isBabysitter?: boolean;
  isParent?: boolean;
  isCaregiver?: boolean;
  activeRole?: 'PARENT' | 'CAREGIVER' | 'BABYSITTER' | 'ADMIN';
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    avatar?: string | null;
    dateOfBirth?: string | Date | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
    province?: string | null;
    zipCode?: string | null;
    postalCode?: string | null;
    country?: string | null;
    emergencyName?: string | null;
    emergencyPhone?: string | null;
    emergencyRelation?: string | null;
  } | null;
  caregiver?: CaregiverData | null;
}

interface SessionData {
  user?: SessionUser;
  expires?: string;
  [key: string]: unknown;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  streetAddress?: string;
  apartment?: string;
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
  location?: { latitude: number; longitude: number; city?: string; state?: string } | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  userType: 'PARENT' | 'CAREGIVER' | 'BABYSITTER' | 'ADMIN'; // Current active role
  approvalStatus: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  profile: UserProfile | null;
  caregiver: CaregiverData | null;
  needsProfileCompletion?: boolean;
  // Dual role support
  hasParentRole: boolean;
  hasCaregiverRole: boolean;
  activeRole: 'PARENT' | 'CAREGIVER' | 'BABYSITTER' | 'ADMIN';
  // Babysitter flag
  isBabysitter: boolean;
  // Prisma relation counts (populated when included in queries)
  _count?: {
    receivedReviews?: number;
    bookings?: number;
    [key: string]: number | undefined;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, userType?: 'parent' | 'caregiver' | 'babysitter', rememberMe?: boolean, twoFactorToken?: string) => Promise<{ success: boolean; error?: string; status?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isParent: boolean;
  isCaregiver: boolean;
  isAdmin: boolean;
  // Dual role support
  hasDualRole: boolean;
  switchRole: (role: 'PARENT' | 'CAREGIVER') => Promise<void>;
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
  const router = useRouter();
  const { data: session, status: sessionStatus, update } = useSession();

  // Helper function to check if user is at least 18 years old
  const isAtLeast18 = (dateOfBirth: string): boolean => {
    if (!dateOfBirth) return false;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    // Check if birthday hasn't happened yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  };

  // Helper function to check if profile is complete (client-side check)
  const isProfileComplete = (profile: UserProfile | null): boolean => {
    if (!profile) {
      console.log('[Client isProfileComplete] No profile - returning false');
      return false;
    }

    const hasPhone = !!(profile.phone && profile.phone.length > 0);
    const hasDOB = !!(profile.dateOfBirth && isAtLeast18(profile.dateOfBirth));
    const hasStreet = !!(profile.streetAddress && profile.streetAddress.length > 0);
    const hasCity = !!(profile.city && profile.city.length > 0);

    const isComplete = hasPhone && hasDOB && hasStreet && hasCity;

    console.log('[Client isProfileComplete] Check:', {
      hasPhone,
      hasDOB,
      hasStreet,
      hasCity,
      isComplete
    });

    return isComplete;
  };

  // Convert NextAuth session to our AuthUser format
  const convertSessionToUser = (session: SessionData): AuthUser | null => {
    if (!session?.user) return null;

    const profile: UserProfile | null = session.user.profile ? {
      firstName: session.user.profile.firstName || session.user.name?.split(' ')[0] || 'User',
      lastName: session.user.profile.lastName || session.user.name?.split(' ').slice(1).join(' ') || '',
      phone: session.user.profile.phone ?? undefined,
      avatar: session.user.profile.avatar || session.user.image,
      dateOfBirth: typeof session.user.profile.dateOfBirth === 'string' ? session.user.profile.dateOfBirth : undefined,
      streetAddress: session.user.profile.streetAddress ?? undefined,
      city: session.user.profile.city ?? undefined,
      state: session.user.profile.state ?? undefined,
      province: session.user.profile.province ?? undefined,
      zipCode: session.user.profile.zipCode ?? undefined,
      postalCode: session.user.profile.postalCode ?? undefined,
      country: session.user.profile.country ?? undefined,
      emergencyName: session.user.profile.emergencyName ?? undefined,
      emergencyPhone: session.user.profile.emergencyPhone ?? undefined,
      emergencyRelation: session.user.profile.emergencyRelation ?? undefined,
    } : {
      firstName: session.user.name?.split(' ')[0] || 'User',
      lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
      avatar: session.user.image ?? undefined
    };

    // Check if profile is complete - compute client-side since NextAuth doesn't pass needsProfileCompletion to client
    // Profile is incomplete if any of the required fields are missing
    const profileIncomplete = !isProfileComplete(profile);

    // Use server value if available, otherwise compute client-side
    const needsProfileCompletion = session.user.needsProfileCompletion !== undefined
      ? session.user.needsProfileCompletion === true
      : profileIncomplete;

    console.log('AuthContext convertSessionToUser:', {
      serverNeedsCompletion: session.user.needsProfileCompletion,
      clientIsProfileComplete: !profileIncomplete,
      finalNeedsCompletion: needsProfileCompletion,
      hasProfile: !!session.user.profile,
      activeRole: session.user.activeRole,
      userType: session.user.userType,
    });

    // Dual role fields - from session or derive from userType
    const hasParentRole = session.user.isParent ?? (session.user.userType === 'PARENT');
    const hasCaregiverRole = session.user.isCaregiver ?? (session.user.userType === 'CAREGIVER');
    const activeRole = (session.user.activeRole || session.user.userType || 'PARENT') as AuthUser['activeRole'];

    return {
      id: session.user.id || '',
      email: session.user.email || '',
      name: session.user.name || 'User',
      userType: activeRole, // Use activeRole as the current effective userType
      approvalStatus: session.user.approvalStatus || 'APPROVED',
      isActive: session.user.isActive !== false,
      emailVerified: session.user.emailVerified !== false,
      lastLogin: session.user.lastLogin || new Date().toISOString(),
      createdAt: session.user.createdAt || new Date().toISOString(),
      profile,
      caregiver: session.user.caregiver || null,
      needsProfileCompletion,
      // Dual role fields
      hasParentRole,
      hasCaregiverRole,
      activeRole,
      // Babysitter flag
      isBabysitter: session.user.isBabysitter ?? false
    };
  };

  // Login function using NextAuth credentials provider
  const login = async (
    email: string,
    password: string,
    userType?: 'parent' | 'caregiver' | 'babysitter',
    rememberMe: boolean = false,
    twoFactorToken?: string
  ): Promise<{ success: boolean; error?: string; status?: string }> => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        userType,
        twoFactorToken: twoFactorToken || '',
        redirect: false,
      });

      if (result?.error) {
        // Detect 2FA required signal from backend
        if (result.error === '2FA_REQUIRED') {
          return { success: false, error: '2FA_REQUIRED', status: '2fa_required' };
        }
        // Handle specific error messages from NextAuth
        return {
          success: false,
          error: result.error,
          status: result.error.includes('pending approval') ? 'pending_approval' : undefined
        };
      }

      if (result?.ok) {
        // Success - trigger redirect based on user type
        setTimeout(() => {
          if (userType === 'babysitter') {
            router.push('/babysitter-dashboard');
          } else if (userType === 'caregiver') {
            router.push('/caregiver-dashboard');
          } else if (userType === 'parent') {
            router.push('/parent-dashboard');
          } else {
            router.push('/dashboard');
          }
        }, 100);
        
        return { success: true };
      }

      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Network error during login' 
      };
    }
  };

  // Logout function using NextAuth
  const logout = async (): Promise<void> => {
    try {
      // Clear user state immediately for better UX
      setUser(null);
      
      // Sign out from NextAuth
      await signOut({ redirect: false });
      
      // Redirect to home
      router.push('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure logout happens even if there's an error
      setUser(null);
      router.push('/');
    }
  };

  // Refresh user data by refetching session
  const refreshUser = async (): Promise<void> => {
    // Use NextAuth update() to refresh session from database without page reload
    await update();
  };

  // Switch active role for dual-role users
  const switchRole = async (role: 'PARENT' | 'CAREGIVER'): Promise<void> => {
    try {
      const response = await fetch('/api/user/switch-role', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role })
      });

      if (response.ok) {
        // Refresh session to get updated activeRole
        await refreshUser();
        // Redirect to appropriate dashboard
        router.push(role === 'CAREGIVER' ? '/caregiver-dashboard' : '/parent-dashboard');
      } else {
        const error = await response.json();
        console.error('Role switch failed:', error);
      }
    } catch (error) {
      console.error('Role switch error:', error);
    }
  };

  // Sync user state with NextAuth session
  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'authenticated' && session) {
      const authUser = convertSessionToUser(session as unknown as SessionData);
      setUser(authUser);
      // Note: Profile completion modal is now shown in Header component
      // No redirect needed - this prevents the refresh loop issue
    } else if (sessionStatus === 'unauthenticated') {
      setUser(null);
    }
  }, [session, sessionStatus]);

  // Helper computed values
  // Keep loading=true until user state is derived from the session
  // This prevents a race condition where sessionStatus='authenticated' but user is still null
  const loading = sessionStatus === 'loading' || (sessionStatus === 'authenticated' && !user);
  const isAuthenticated = !!user && sessionStatus === 'authenticated';
  const isParent = user?.userType === 'PARENT';
  const isCaregiver = user?.userType === 'CAREGIVER';
  const isAdmin = user?.userType === 'ADMIN';
  // Dual role support
  const hasDualRole = !!(user?.hasParentRole && user?.hasCaregiverRole);

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
    // Dual role support
    hasDualRole,
    switchRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}