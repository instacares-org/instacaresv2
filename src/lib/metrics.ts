// @ts-ignore - no type declarations available for node-statsd
import StatsD from 'node-statsd';

class MetricsClient {
  private client: StatsD | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Only enable in production
    if (process.env.NODE_ENV === 'production') {
      try {
        this.client = new StatsD({
          host: 'localhost',
          port: 8125,
          prefix: 'instacares.',
          cacheDns: true,
          // Don't throw errors, just log them
          errorHandler: (error: Error) => {
            console.error('[Metrics] StatsD error:', error.message);
          }
        });
        this.isEnabled = true;
        console.log('[Metrics] StatsD client initialized');
      } catch (error) {
        console.error('[Metrics] Failed to initialize StatsD:', error);
      }
    } else {
      console.log('[Metrics] StatsD disabled (not production)');
    }
  }

  // Authentication metrics
  authSuccess(userType: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`auth.login.success.${userType.toLowerCase()}`);
    this.client?.increment('auth.login.success.total');
  }

  authFailure(reason: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`auth.login.failure.${reason.toLowerCase().replace(/\s+/g, '_')}`);
    this.client?.increment('auth.login.failure.total');
  }

  authLogout(userType: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`auth.logout.${userType.toLowerCase()}`);
  }

  // Booking metrics
  bookingCreated(province?: string) {
    if (!this.isEnabled) return;
    this.client?.increment('booking.created');
    if (province) {
      this.client?.increment(`booking.created.${province.toLowerCase()}`);
    }
  }

  bookingConfirmed() {
    if (!this.isEnabled) return;
    this.client?.increment('booking.confirmed');
  }

  bookingCancelled(reason?: string) {
    if (!this.isEnabled) return;
    this.client?.increment('booking.cancelled');
    if (reason) {
      this.client?.increment(`booking.cancelled.${reason.toLowerCase().replace(/\s+/g, '_')}`);
    }
  }

  bookingCompleted() {
    if (!this.isEnabled) return;
    this.client?.increment('booking.completed');
  }

  // Payment metrics
  paymentProcessed(amount: number, currency: string = 'CAD') {
    if (!this.isEnabled) return;
    this.client?.increment('payment.processed');
    this.client?.gauge(`payment.amount.${currency.toLowerCase()}`, amount);
  }

  paymentFailed(reason: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`payment.failed.${reason.toLowerCase().replace(/\s+/g, '_')}`);
    this.client?.increment('payment.failed.total');
  }

  paymentRefunded(amount: number) {
    if (!this.isEnabled) return;
    this.client?.increment('payment.refunded');
    this.client?.gauge('payment.refund.amount', amount);
  }

  // User registration metrics
  userRegistered(userType: string, province?: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`user.registered.${userType.toLowerCase()}`);
    if (province) {
      this.client?.increment(`user.registered.${province.toLowerCase()}`);
    }
  }

  // Profile metrics
  profileUpdated(userType: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`profile.updated.${userType.toLowerCase()}`);
  }

  childProfileCreated() {
    if (!this.isEnabled) return;
    this.client?.increment('child.profile.created');
  }

  // API performance metrics
  apiResponseTime(endpoint: string, duration: number) {
    if (!this.isEnabled) return;
    const cleanEndpoint = endpoint.replace(/\//g, '.').replace(/^\./, '');
    this.client?.timing(`api.response_time.${cleanEndpoint}`, duration);
  }

  apiError(endpoint: string, statusCode: number) {
    if (!this.isEnabled) return;
    const cleanEndpoint = endpoint.replace(/\//g, '.').replace(/^\./, '');
    this.client?.increment(`api.error.${cleanEndpoint}`);
    this.client?.increment(`api.error.status.${statusCode}`);
  }

  // Search metrics
  searchPerformed(searchType: string) {
    if (!this.isEnabled) return;
    this.client?.increment(`search.${searchType.toLowerCase()}`);
  }

  // Chat/messaging metrics
  messageSent() {
    if (!this.isEnabled) return;
    this.client?.increment('chat.message.sent');
  }

  // Custom gauge
  gauge(metric: string, value: number) {
    if (!this.isEnabled) return;
    this.client?.gauge(metric, value);
  }

  // Custom counter
  increment(metric: string, value: number = 1) {
    if (!this.isEnabled) return;
    this.client?.increment(metric, value);
  }

  // Custom timing
  timing(metric: string, duration: number) {
    if (!this.isEnabled) return;
    this.client?.timing(metric, duration);
  }

  // Close connection (for graceful shutdown)
  close() {
    if (this.client) {
      this.client.close();
    }
  }
}

// Export singleton instance
export const metrics = new MetricsClient();
