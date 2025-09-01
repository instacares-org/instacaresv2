import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:3000'; // Replace with your server URL

interface LoginResponse {
  user: User;
  token: string;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'parent' | 'caregiver';
}

class AuthServiceClass {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'An error occurred',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signup(userData: SignupData): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData']);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Failed to logout',
      };
    }
  }

  async refreshToken(): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/api/auth/refresh', {
      method: 'POST',
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async deleteAccount(): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/auth/account', {
      method: 'DELETE',
    });
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification(): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/auth/resend-verification', {
      method: 'POST',
    });
  }
}

export const AuthService = new AuthServiceClass();