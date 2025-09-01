import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export class EmailService {
  private from: string;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'Instacares <noreply@instacares.com>';
  }

  /**
   * Send a single email
   */
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await resend.emails.send({
        from: options.from || this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      });

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
      }

      console.log('Email sent successfully:', data);
      return { success: true };
    } catch (error) {
      console.error('Email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      };
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(
    to: string,
    booking: {
      id: string;
      caregiverName: string;
      parentName: string;
      date: string;
      time: string;
      duration: number;
      totalAmount: number;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e11d48;">Booking Confirmed!</h1>
        <p>Hi ${booking.parentName},</p>
        <p>Your booking with ${booking.caregiverName} has been confirmed.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Booking Details:</h3>
          <p><strong>Date:</strong> ${booking.date}</p>
          <p><strong>Time:</strong> ${booking.time}</p>
          <p><strong>Duration:</strong> ${booking.duration} hours</p>
          <p><strong>Total Amount:</strong> $${booking.totalAmount}</p>
          <p><strong>Booking ID:</strong> ${booking.id}</p>
        </div>
        
        <p>You can view your booking details and message your caregiver in your dashboard.</p>
        
        <div style="margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/parent-dashboard" 
             style="background: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Dashboard
          </a>
        </div>
        
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated message from Instacares. Please do not reply to this email.
        </p>
      </div>
    `;

    return this.send({
      to,
      subject: `Booking Confirmed with ${booking.caregiverName}`,
      html,
    });
  }

  /**
   * Send new booking notification to caregiver
   */
  async sendNewBookingToCaregiver(
    to: string,
    booking: {
      id: string;
      parentName: string;
      date: string;
      time: string;
      duration: number;
      childrenCount: number;
      message?: string;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981;">New Booking Request!</h1>
        <p>You have a new booking from ${booking.parentName}.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Booking Details:</h3>
          <p><strong>Date:</strong> ${booking.date}</p>
          <p><strong>Time:</strong> ${booking.time}</p>
          <p><strong>Duration:</strong> ${booking.duration} hours</p>
          <p><strong>Number of Children:</strong> ${booking.childrenCount}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ''}
        </div>
        
        <div style="margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/caregiver-dashboard" 
             style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Booking
          </a>
        </div>
      </div>
    `;

    return this.send({
      to,
      subject: `New Booking from ${booking.parentName}`,
      html,
    });
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotice(
    to: string,
    details: {
      bookingId: string;
      cancelledBy: string;
      reason?: string;
      refundAmount?: number;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">Booking Cancelled</h1>
        <p>Booking ${details.bookingId} has been cancelled by ${details.cancelledBy}.</p>
        ${details.reason ? `<p><strong>Reason:</strong> ${details.reason}</p>` : ''}
        ${details.refundAmount ? `<p><strong>Refund Amount:</strong> $${details.refundAmount}</p>` : ''}
        
        <p>If you have any questions, please contact support.</p>
      </div>
    `;

    return this.send({
      to,
      subject: `Booking Cancelled - ${details.bookingId}`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();