'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';

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
  name?: string;
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
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Convert NextAuth session to our AuthUser format
  const convertSessionToUser = (session: any): AuthUser | null => {
    if (!session?.user) return null;
    
    return {
      id: session.user.id || '',
      email: session.user.email || '',
      name: session.user.name || 'User',
      userType: session.user.userType || 'PARENT',
      approvalStatus: session.user.approvalStatus || 'APPROVED',
      isActive: session.user.isActive !== false,
      emailVerified: session.user.emailVerified !== false,
      lastLogin: session.user.lastLogin || new Date().toISOString(),
      createdAt: session.user.createdAt || new Date().toISOString(),
      profile: session.user.profile ? {
        firstName: session.user.profile.firstName || session.user.name?.split(' ')[0] || 'User',
        lastName: session.user.profile.lastName || session.user.name?.split(' ').slice(1).join(' ') || '',
        phone: session.user.profile.phone,
        avatar: session.user.profile.avatar || session.user.image,
        dateOfBirth: session.user.profile.dateOfBirth,
        streetAddress: session.user.profile.streetAddress,
        city: session.user.profile.city,
        state: session.user.profile.state,
        province: session.user.profile.province,
        zipCode: session.user.profile.zipCode,
        postalCode: session.user.profile.postalCode,
        country: session.user.profile.country,
        emergencyName: session.user.profile.emergencyName,
        emergencyPhone: session.user.profile.emergencyPhone,
        emergencyRelation: session.user.profile.emergencyRelation,
      } : {
        firstName: session.user.name?.split(' ')[0] || 'User',
        lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
        avatar: session.user.image
      },
      caregiver: session.user.caregiver || null
    };
  };

  // Login function using NextAuth credentials provider
  const login = async (
    email: string, 
    password: string, 
    userType?: 'parent' | 'caregiver',
    rememberMe: boolean = false
  ): Promise<{ success: boolean; error?: string; status?: string }> => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        userType,
        redirect: false,
      });

      if (result?.error) {
        // Handle specific error messages from NextAuth
        return { 
          success: false, 
          error: result.error,
          status: result.error.includes('pending approval') ? 'pending_approval' : undefined
        };
      }

      if (result?.ok) {
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
    // NextAuth automatically handles session refresh
    // The useEffect below will update the user state
    window.location.reload();
  };

  // Sync user state with NextAuth session
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    
    if (sessionStatus === 'authenticated' && session) {
      const authUser = convertSessionToUser(session);
      setUser(authUser);
    } else if (sessionStatus === 'unauthenticated') {
      setUser(null);
    }
  }, [session, sessionStatus]);

  // Helper computed values
  const loading = sessionStatus === 'loading';
  const isAuthenticated = !!user && sessionStatus === 'authenticated';
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