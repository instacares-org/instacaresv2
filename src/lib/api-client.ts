/**
 * Enhanced API client with automatic token refresh
 */

import { tokenManager } from './token-manager';

interface RequestOptions extends RequestInit {
  skipRetry?: boolean;
}

class ApiClient {
  private static instance: ApiClient;
  private baseURL: string;

  private constructor() {
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? '' // Use same origin in production
      : 'http://localhost:3005'; // Development server
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Enhanced fetch with automatic token refresh on 401
   */
  async fetch(url: string, options: RequestOptions = {}): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    // Default options
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(fullUrl, defaultOptions);

      // If we get a 401 and haven't already retried, try to refresh the token
      if (response.status === 401 && !options.skipRetry) {
        console.log('Received 401, attempting token refresh...');
        
        const refreshSuccess = await tokenManager.forceRefresh();
        
        if (refreshSuccess) {
          console.log('Token refreshed, retrying request...');
          // Retry the original request with the new token
          return this.fetch(url, { ...options, skipRetry: true });
        } else {
          console.log('Token refresh failed, redirecting to login');
          // Token refresh failed - the token manager will handle redirect
          return response;
        }
      }

      return response;

    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * GET request with automatic retry
   */
  async get(url: string, options: RequestOptions = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  /**
   * POST request with automatic retry
   */
  async post(url: string, data?: any, options: RequestOptions = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request with automatic retry
   */
  async put(url: string, data?: any, options: RequestOptions = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request with automatic retry
   */
  async delete(url: string, options: RequestOptions = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }

  /**
   * JSON helper - automatically parses JSON responses
   */
  async json<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    return response.json();
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Export for direct usage
export default apiClient;