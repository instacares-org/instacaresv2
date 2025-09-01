import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface SMSOptions {
  to: string;
  body: string;
}

export class SMSService {
  private from: string;
  private isEnabled: boolean;

  constructor() {
    this.from = process.env.TWILIO_PHONE_NUMBER || '';
    this.isEnabled = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }

  /**
   * Format phone number to E.164 format (required by Twilio)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // If it's a 10-digit North American number, add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // If it already has country code
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // Return as is with + prefix if not already there
    return phone.startsWith('+') ? phone : `+${phone}`;
  }

  /**
   * Send a single SMS
   */
  async send(options: SMSOptions): Promise<{ success: boolean; error?: string; sid?: string }> {
    if (!this.isEnabled) {
      console.log('SMS Service disabled - would send:', options);
      return { success: true, error: 'SMS service not configured (dev mode)' };
    }

    try {
      const formattedTo = this.formatPhoneNumber(options.to);
      
      const message = await twilioClient.messages.create({
        body: options.body,
        from: this.from,
        to: formattedTo,
      });

      console.log('SMS sent successfully:', message.sid);
      return { success: true, sid: message.sid };
    } catch (error) {
      console.error('SMS send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send SMS' 
      };
    }
  }

  /**
   * Send booking confirmation SMS
   */
  async sendBookingConfirmationSMS(
    to: string,
    booking: {
      caregiverName: string;
      date: string;
      time: string;
    }
  ) {
    const body = `Instacares: Your booking with ${booking.caregiverName} on ${booking.date} at ${booking.time} is confirmed. Check your dashboard for details.`;
    
    return this.send({ to, body });
  }

  /**
   * Send urgent notification to caregiver
   */
  async sendUrgentBookingAlert(
    to: string,
    booking: {
      parentName: string;
      time: string;
    }
  ) {
    const body = `Instacares URGENT: New booking from ${booking.parentName} for ${booking.time}. Open your dashboard to respond.`;
    
    return this.send({ to, body });
  }

  /**
   * Send reminder SMS
   */
  async sendReminder(
    to: string,
    reminder: {
      type: 'booking' | 'payment' | 'review';
      details: string;
    }
  ) {
    const body = `Instacares Reminder: ${reminder.details}`;
    
    return this.send({ to, body });
  }

  /**
   * Send verification code
   */
  async sendVerificationCode(to: string, code: string) {
    const body = `Your Instacares verification code is: ${code}. Valid for 10 minutes.`;
    
    return this.send({ to, body });
  }

  /**
   * Send cancellation SMS
   */
  async sendCancellationSMS(
    to: string,
    details: {
      bookingDate: string;
      cancelledBy: string;
    }
  ) {
    const body = `Instacares: Your booking for ${details.bookingDate} has been cancelled by ${details.cancelledBy}. Check your email for details.`;
    
    return this.send({ to, body });
  }
}

// Export singleton instance
export const smsService = new SMSService();