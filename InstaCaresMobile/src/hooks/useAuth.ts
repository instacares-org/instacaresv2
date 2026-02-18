import { useState, useEffect } from 'react';
import { authAPI, tokenManager } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'caregiver' | 'admin';
  phone?: string;
  profilePicture?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const token = await tokenManager.getToken();
      if (token) {
        const userData = await authAPI.checkAuth();
        setAuthState({
          user: userData.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      
      // If token is invalid, clear it
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        await tokenManager.removeToken();
        await tokenManager.removeUser();
      }
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status',
      });
    }
  };

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await authAPI.login(email, password);
      setAuthState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return { success: true, user: response.user };
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: 'parent' | 'caregiver';
  }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await authAPI.register(userData);
      setAuthState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return { success: true, user: response.user };
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authAPI.logout();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      await tokenManager.removeToken();
      await tokenManager.removeUser();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  return {
    ...authState,
    login,
    register,
    logout,
    checkAuthStatus,
  };
};