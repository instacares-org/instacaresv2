/**
 * Client-side token management with automatic refresh
 */

interface TokenData {
  token: string;
  expiresAt: number;
}

class TokenManager {
  private static instance: TokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  private constructor() {
    // Initialize token refresh on page load
    if (typeof window !== 'undefined') {
      this.initializeTokenRefresh();
    }
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get current auth token from cookie
   */
  private getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth-token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Parse JWT token to get expiry
   */
  private parseTokenExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expiring soon (within 5 minutes)
   */
  private isTokenExpiringSoon(expiresAt: number): boolean {
    const currentTime = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return (expiresAt - currentTime) <= fiveMinutes;
  }

  /**
   * Refresh the auth token
   */
  private async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) return true;
    
    this.isRefreshing = true;
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Token refreshed successfully');
          this.scheduleNextRefresh();
          return true;
        }
      }

      console.warn('Token refresh failed');
      // Token refresh failed - redirect to login
      this.handleTokenExpiry();
      return false;

    } catch (error) {
      console.error('Token refresh error:', error);
      this.handleTokenExpiry();
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Handle token expiry by redirecting to login
   */
  private handleTokenExpiry(): void {
    // Clear any existing refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Only redirect if we're on a protected page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const publicPaths = ['/', '/login', '/signup'];
      
      if (!publicPaths.includes(currentPath)) {
        // Store intended destination
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        
        // Redirect to login
        window.location.href = '/login';
      }
    }
  }

  /**
   * Schedule the next token refresh
   */
  private scheduleNextRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const token = this.getTokenFromCookie();
    if (!token) return;

    const expiresAt = this.parseTokenExpiry(token);
    if (!expiresAt) return;

    const currentTime = Date.now();
    const timeUntilExpiry = expiresAt - currentTime;
    
    // Refresh 5 minutes before expiry, but at least 1 minute from now
    const refreshIn = Math.max(
      timeUntilExpiry - (5 * 60 * 1000), // 5 minutes before expiry
      60 * 1000 // At least 1 minute from now
    );

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshIn);

      console.log(`Token refresh scheduled in ${Math.round(refreshIn / 60000)} minutes`);
    } else {
      // Token is already expired or expiring very soon
      this.refreshToken();
    }
  }

  /**
   * Initialize token refresh system
   */
  private initializeTokenRefresh(): void {
    const token = this.getTokenFromCookie();
    if (!token) return;

    const expiresAt = this.parseTokenExpiry(token);
    if (!expiresAt) return;

    // If token is expiring soon, refresh immediately
    if (this.isTokenExpiringSoon(expiresAt)) {
      this.refreshToken();
    } else {
      this.scheduleNextRefresh();
    }

    // Also set up visibility change listener to refresh on tab focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const currentToken = this.getTokenFromCookie();
        if (currentToken) {
          const currentExpiresAt = this.parseTokenExpiry(currentToken);
          if (currentExpiresAt && this.isTokenExpiringSoon(currentExpiresAt)) {
            this.refreshToken();
          }
        }
      }
    });
  }

  /**
   * Manually trigger token refresh (for API error handling)
   */
  public async forceRefresh(): Promise<boolean> {
    return this.refreshToken();
  }

  /**
   * Start the token manager (call this in your app initialization)
   */
  public start(): void {
    this.initializeTokenRefresh();
  }

  /**
   * Stop the token manager and clear timers
   */
  public stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Auto-start token manager in browser environment
if (typeof window !== 'undefined') {
  tokenManager.start();
}

export default tokenManager;