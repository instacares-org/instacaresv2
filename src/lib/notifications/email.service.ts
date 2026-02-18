import { Resend } from 'resend';

// Initialize Resend client with fallback
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('your_resend_api_key')) {
    console.warn('Resend API key not configured, using mock client');
    return null;
  }
  return new Resend(apiKey);
};

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export class EmailService {
  /**
   * Get the FROM address at runtime to ensure env vars are loaded
   */
  private getFromAddress(): string {
    return process.env.EMAIL_FROM || 'InstaCares <noreply@instacares.net>';
  }

  /**
   * Send a single email
   */
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const resend = getResendClient();

      if (!resend) {
        console.warn('Email service not configured, skipping email send');
        return { success: true, error: 'Email service not configured (development mode)' };
      }

      const fromAddress = options.from || this.getFromAddress();
      console.log('Sending email from:', fromAddress, 'to:', options.to);

      const emailPayload: any = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      };

      // Add attachments if provided
      if (options.attachments && options.attachments.length > 0) {
        emailPayload.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        }));
      }

      const { data, error } = await resend.emails.send(emailPayload);

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
   * Send booking confirmation email to parent
   */
  async sendBookingConfirmation(
    to: string,
    booking: {
      id: string;
      caregiverName: string;
      parentName?: string;
      date: string;
      time: string;
      startTime?: string;
      endTime?: string;
      duration?: number;
      totalAmount: number | string;
      address?: string;
      dropOffAddress?: string; // Caregiver's address for drop-off
      childrenCount?: number;
    },
    invoiceHtml?: string // Optional invoice HTML attachment
  ) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.net';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmed</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">

                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #7dd3c7 0%, #fcd775 50%, #f4a89a 100%); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center;">
                      <img src="${baseUrl}/logo-optimized.png" alt="InstaCares" width="100" height="100" style="display: block; margin: 0 auto 15px; width: 100px; height: 100px; object-fit: contain; border-radius: 12px; background: white;" />
                      <h1 style="margin: 0; color: #3D3D4D; font-size: 28px; font-weight: 700;">Booking Confirmed!</h1>
                      <p style="margin: 10px 0 0; color: #4a4a5a; font-size: 16px;">Your childcare is all set</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background: white; padding: 40px 35px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

                      <p style="font-size: 20px; color: #3D3D4D; margin: 0 0 20px; font-weight: 600;">Hi ${booking.parentName || 'there'}!</p>

                      <p style="font-size: 16px; color: #5a5a6a; line-height: 1.7; margin: 0 0 25px;">
                        Great news! Your booking with <strong style="color: #5CBDB7;">${booking.caregiverName}</strong> has been confirmed.
                      </p>

                      <!-- Booking Details Card -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #f0fdf9 0%, #ccfbf1 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #5CBDB7;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 20px; color: #0d9488; font-size: 17px; font-weight: 600;">Booking Details</h3>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>Date:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.date}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>Start Time:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.startTime || booking.time}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>End Time:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.endTime || 'N/A'}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>Duration:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.duration} hours
                                </td>
                              </tr>
                              ${booking.dropOffAddress ? `
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>Drop-off Address:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.dropOffAddress}
                                </td>
                              </tr>
                              ` : ''}
                              ${booking.address ? `
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px;">
                                  <strong>Service Location:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 14px; text-align: right;">
                                  ${booking.address}
                                </td>
                              </tr>
                              ` : ''}
                              <tr>
                                <td colspan="2" style="padding: 15px 0 8px; border-top: 1px dashed #a7f3d0;">
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #047857; font-size: 16px;">
                                  <strong>Total Amount:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #047857; font-size: 18px; text-align: right; font-weight: 700;">
                                  $${typeof booking.totalAmount === 'number' ? booking.totalAmount.toFixed(2) : booking.totalAmount}
                                </td>
                              </tr>
                            </table>
                            <p style="margin: 15px 0 0; color: #6b7280; font-size: 12px;">Booking ID: ${booking.id}</p>
                          </td>
                        </tr>
                      </table>

                      <!-- What's Next -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border-radius: 16px; margin: 25px 0;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #3D3D4D; font-size: 15px; font-weight: 600;">What's Next?</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                              <li style="margin-bottom: 6px;">Your caregiver has been notified</li>
                              <li style="margin-bottom: 6px;">You can message them through your dashboard</li>
                              <li style="margin-bottom: 6px;">Prepare any special instructions for the caregiver</li>
                              <li style="margin-bottom: 0;">We'll send you a reminder before the booking</li>
                            </ul>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Buttons -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="padding: 30px 0;">
                            <!-- Bulletproof Button for Email Clients -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" bgcolor="#5CBDB7" style="border-radius: 10px;">
                                  <a href="${baseUrl}/parent-dashboard"
                                     target="_blank"
                                     style="display: inline-block; padding: 18px 45px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #5CBDB7; border: 1px solid #5CBDB7;">
                                    View Booking Details
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding: 10px 0 20px;">
                            <!-- Bulletproof Button for Email Clients -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" bgcolor="#3D3D4D" style="border-radius: 8px;">
                                  <a href="${baseUrl}/api/invoices/download/${booking.id}?type=parent"
                                     target="_blank"
                                     style="display: inline-block; padding: 14px 35px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #3D3D4D; border: 1px solid #3D3D4D;">
                                    &#128196; Download Invoice (PDF)
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Divider -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent);"></div>
                          </td>
                        </tr>
                      </table>

                      <!-- Support Section -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 20px 0 0; text-align: center;">
                            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">
                              Need to make changes? Contact us at
                            </p>
                            <p style="font-size: 14px; color: #6b7280; margin: 0;">
                              <a href="mailto:support@instacares.net" style="color: #5CBDB7; text-decoration: none; font-weight: 500;">support@instacares.net</a>
                            </p>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px; text-align: center;">
                      <p style="color: #3D3D4D; font-size: 14px; font-weight: 600; margin: 0 0 8px;">InstaCares</p>
                      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px;">Trusted Childcare Platform</p>
                      <p style="color: #b0b0b0; font-size: 11px; margin: 15px 0 0;">&copy; ${new Date().getFullYear()} InstaCares. All rights reserved.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Note: We no longer attach invoices - users can download via the button link
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
      startTime?: string;
      endTime?: string;
      duration: number;
      totalAmount: number | string;
      address?: string;
      message?: string;
      childrenCount?: number;
      children?: Array<{
        firstName: string;
        lastName?: string;
        age: number;
        allergies?: string;
        medicalConditions?: string;
        specialInstructions?: string;
      }>;
      emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
      };
    },
    invoiceHtml?: string // Optional invoice HTML attachment
  ) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.net';

    // Build children info HTML - handle case where children array is not provided
    const children = booking.children || [];
    const childrenCount = booking.childrenCount || children.length || 1;
    const childrenHtml = children.length > 0 ? children.map((child, index) => `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-radius: 12px; margin: ${index > 0 ? '15px' : '0'} 0 0; border: 1px solid #e5e7eb;">
        <tr>
          <td style="padding: 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding-bottom: 10px;">
                  <span style="display: inline-block; background: linear-gradient(135deg, #E8786B 0%, #f4a89a 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Child ${index + 1}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <h4 style="margin: 0 0 12px; color: #3D3D4D; font-size: 18px; font-weight: 600;">${child.firstName}${child.lastName ? ' ' + child.lastName : ''}</h4>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #5a5a6a; font-size: 14px;">
                  <strong style="color: #3D3D4D;">Age:</strong> ${child.age} years old
                </td>
              </tr>
              ${child.allergies ? `
              <tr>
                <td style="padding: 6px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #fef2f2; border-radius: 8px; border-left: 3px solid #ef4444;">
                    <tr>
                      <td style="padding: 10px 12px;">
                        <strong style="color: #dc2626; font-size: 13px;">⚠️ Allergies:</strong>
                        <span style="color: #7f1d1d; font-size: 13px;">${child.allergies}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
              ${child.medicalConditions ? `
              <tr>
                <td style="padding: 6px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;">
                    <tr>
                      <td style="padding: 10px 12px;">
                        <strong style="color: #b45309; font-size: 13px;">🏥 Medical Conditions:</strong>
                        <span style="color: #78350f; font-size: 13px;">${child.medicalConditions}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
              ${child.specialInstructions ? `
              <tr>
                <td style="padding: 6px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f0fdf4; border-radius: 8px; border-left: 3px solid #22c55e;">
                    <tr>
                      <td style="padding: 10px 12px;">
                        <strong style="color: #15803d; font-size: 13px;">📝 Special Instructions:</strong>
                        <span style="color: #166534; font-size: 13px;">${child.specialInstructions}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>
    `).join('') : `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-radius: 12px; border: 1px solid #e5e7eb;">
        <tr>
          <td style="padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            ${childrenCount} ${childrenCount > 1 ? 'children' : 'child'} will be in your care. Check your dashboard for more details.
          </td>
        </tr>
      </table>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Booking Request</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">

                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #7dd3c7 0%, #fcd775 50%, #f4a89a 100%); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center;">
                      <img src="${baseUrl}/logo-optimized.png" alt="InstaCares" width="100" height="100" style="display: block; margin: 0 auto 15px; width: 100px; height: 100px; object-fit: contain; border-radius: 12px; background: white;" />
                      <h1 style="margin: 0; color: #3D3D4D; font-size: 28px; font-weight: 700;">New Booking!</h1>
                      <p style="margin: 10px 0 0; color: #4a4a5a; font-size: 16px;">A family needs your help</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background: white; padding: 40px 35px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

                      <p style="font-size: 16px; color: #5a5a6a; line-height: 1.7; margin: 0 0 25px;">
                        Great news! <strong style="color: #F5C857;">${booking.parentName}</strong> has booked you for childcare.
                      </p>

                      <!-- Booking Details Card -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fef7e0 0%, #fef3c7 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #F5C857;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 20px; color: #92400e; font-size: 17px; font-weight: 600;">📅 Booking Details</h3>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>Date:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${booking.date}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>Start Time:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${booking.startTime || booking.time}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>End Time:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${booking.endTime || 'N/A'}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>Duration:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${booking.duration} hours
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>Children:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${childrenCount}
                                </td>
                              </tr>
                              ${booking.address ? `
                              <tr>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px;">
                                  <strong>Location:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #b45309; font-size: 14px; text-align: right;">
                                  ${booking.address}
                                </td>
                              </tr>
                              ` : ''}
                              <tr>
                                <td colspan="2" style="padding: 15px 0 8px; border-top: 1px dashed #fcd34d;">
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #92400e; font-size: 16px;">
                                  <strong>Your Earnings:</strong>
                                </td>
                                <td style="padding: 8px 0; color: #92400e; font-size: 18px; text-align: right; font-weight: 700;">
                                  $${typeof booking.totalAmount === 'number' ? booking.totalAmount.toFixed(2) : booking.totalAmount}
                                </td>
                              </tr>
                            </table>
                            <p style="margin: 15px 0 0; color: #78350f; font-size: 12px;">Booking ID: ${booking.id}</p>
                          </td>
                        </tr>
                      </table>

                      ${booking.message ? `
                      <!-- Parent Message -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border-radius: 16px; margin: 25px 0;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #3D3D4D; font-size: 15px; font-weight: 600;">💬 Message from ${booking.parentName}:</h3>
                            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.7; font-style: italic;">"${booking.message}"</p>
                          </td>
                        </tr>
                      </table>
                      ` : ''}

                      <!-- Children Information Section -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #E8786B;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 20px; color: #9d174d; font-size: 17px; font-weight: 600;">👶 Children Information</h3>
                            <p style="margin: 0 0 15px; color: #be185d; font-size: 14px;">Please review this important information about the ${childrenCount > 1 ? 'children' : 'child'} you'll be caring for:</p>
                            ${childrenHtml}
                          </td>
                        </tr>
                      </table>

                      ${booking.emergencyContact ? `
                      <!-- Emergency Contact -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #fef2f2; border-radius: 16px; margin: 25px 0; border-left: 4px solid #ef4444;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #dc2626; font-size: 15px; font-weight: 600;">🚨 Emergency Contact</h3>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="padding: 4px 0; color: #7f1d1d; font-size: 14px;">
                                  <strong>Name:</strong> ${booking.emergencyContact.name}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; color: #7f1d1d; font-size: 14px;">
                                  <strong>Phone:</strong> ${booking.emergencyContact.phone}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; color: #7f1d1d; font-size: 14px;">
                                  <strong>Relationship:</strong> ${booking.emergencyContact.relationship}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      ` : ''}

                      <!-- CTA Buttons -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="padding: 30px 0;">
                            <!-- Bulletproof Button for Email Clients -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" bgcolor="#E8786B" style="border-radius: 10px;">
                                  <a href="${baseUrl}/caregiver-dashboard"
                                     target="_blank"
                                     style="display: inline-block; padding: 18px 45px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #E8786B; border: 1px solid #E8786B;">
                                    View Booking Details
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding: 10px 0 20px;">
                            <!-- Bulletproof Button for Email Clients -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" bgcolor="#3D3D4D" style="border-radius: 8px;">
                                  <a href="${baseUrl}/api/invoices/download/${booking.id}?type=caregiver"
                                     target="_blank"
                                     style="display: inline-block; padding: 14px 35px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #3D3D4D; border: 1px solid #3D3D4D;">
                                    &#128196; Download Payout Statement (PDF)
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Divider -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent);"></div>
                          </td>
                        </tr>
                      </table>

                      <!-- Support Section -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 20px 0 0; text-align: center;">
                            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">
                              Questions about this booking? Contact us at
                            </p>
                            <p style="font-size: 14px; color: #6b7280; margin: 0;">
                              <a href="mailto:support@instacares.net" style="color: #E8786B; text-decoration: none; font-weight: 500;">support@instacares.net</a>
                            </p>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px; text-align: center;">
                      <p style="color: #3D3D4D; font-size: 14px; font-weight: 600; margin: 0 0 8px;">InstaCares</p>
                      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px;">Trusted Childcare Platform</p>
                      <p style="color: #b0b0b0; font-size: 11px; margin: 15px 0 0;">&copy; ${new Date().getFullYear()} InstaCares. All rights reserved.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Note: We no longer attach invoices - users can download via the button link
    return this.send({
      to,
      subject: `New Booking from ${booking.parentName} - ${booking.date}`,
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

  /**
   * Send refund notification to parent
   */
  async sendRefundNotification(
    to: string,
    details: {
      bookingId: string;
      refundAmount: number;
      refundPercentage: number;
      reason: string;
      caregiverName: string;
      bookingDate: string;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981;">Refund Processed</h1>
        <p>Your refund for the cancelled booking has been processed.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Refund Details:</h3>
          <p><strong>Booking ID:</strong> ${details.bookingId}</p>
          <p><strong>Caregiver:</strong> ${details.caregiverName}</p>
          <p><strong>Original Date:</strong> ${details.bookingDate}</p>
          <p><strong>Refund Amount:</strong> $${details.refundAmount.toFixed(2)}</p>
          <p><strong>Refund Percentage:</strong> ${details.refundPercentage}%</p>
          <p><strong>Reason:</strong> ${details.reason}</p>
        </div>

        <p>The refund will be credited to your original payment method within 5-10 business days.</p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          If you have any questions about this refund, please contact our support team.
        </p>
      </div>
    `;

    return this.send({
      to,
      subject: `Refund Processed - $${details.refundAmount.toFixed(2)}`,
      html,
    });
  }

  /**
   * Send warning notification to caregiver
   */
  async sendCaregiverWarning(
    to: string,
    details: {
      warningType: string;
      description: string;
      strikeNumber: number;
      bookingId?: string;
    }
  ) {
    const isThirdStrike = details.strikeNumber >= 3;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${isThirdStrike ? '#ef4444' : '#f59e0b'};">
          ${isThirdStrike ? 'Account Under Review' : 'Warning Issued'}
        </h1>

        <p>You have received a warning on your Instacares account.</p>

        <div style="background: ${isThirdStrike ? '#fef2f2' : '#fffbeb'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isThirdStrike ? '#ef4444' : '#f59e0b'};">
          <h3 style="margin-top: 0;">Warning Details:</h3>
          <p><strong>Type:</strong> ${details.warningType.replace('_', ' ')}</p>
          <p><strong>Description:</strong> ${details.description}</p>
          <p><strong>Strike Number:</strong> ${details.strikeNumber} of 3</p>
          ${details.bookingId ? `<p><strong>Related Booking:</strong> ${details.bookingId}</p>` : ''}
        </div>

        ${isThirdStrike ? `
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #ef4444; font-weight: bold; margin: 0;">
              This is your third warning. Your account is now under review by our admin team.
              You may experience restrictions on your account until the review is complete.
            </p>
          </div>
        ` : `
          <p>Please review our <a href="${process.env.NEXT_PUBLIC_BASE_URL}/terms">Terms of Service</a> to avoid further warnings.</p>
        `}

        <p>If you believe this warning was issued in error, please contact our support team.</p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated message from Instacares.
        </p>
      </div>
    `;

    return this.send({
      to,
      subject: isThirdStrike
        ? 'Important: Your Account is Under Review'
        : `Warning Issued - Strike ${details.strikeNumber} of 3`,
      html,
    });
  }

  /**
   * Send support ticket confirmation
   */
  async sendTicketConfirmation(
    to: string,
    details: {
      ticketNumber: string;
      subject: string;
      category: string;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Support Ticket Received</h1>
        <p>We've received your support request and will respond as soon as possible.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ticket Details:</h3>
          <p><strong>Ticket Number:</strong> ${details.ticketNumber}</p>
          <p><strong>Subject:</strong> ${details.subject}</p>
          <p><strong>Category:</strong> ${details.category.replace('_', ' ')}</p>
        </div>

        <p>You can track your ticket status and add additional information in your dashboard.</p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          Please do not reply to this email. Use the dashboard to communicate with our support team.
        </p>
      </div>
    `;

    return this.send({
      to,
      subject: `Support Ticket ${details.ticketNumber} - ${details.subject}`,
      html,
    });
  }

  /**
   * Send ticket response notification
   */
  async sendTicketResponseNotification(
    to: string,
    details: {
      ticketNumber: string;
      subject: string;
      responsePreview: string;
    }
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">New Response on Your Ticket</h1>
        <p>Our support team has responded to your ticket.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Ticket:</strong> ${details.ticketNumber}</p>
          <p><strong>Subject:</strong> ${details.subject}</p>
          <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            ${details.responsePreview}...
          </p>
        </div>

        <div style="margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard"
             style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Full Response
          </a>
        </div>
      </div>
    `;

    return this.send({
      to,
      subject: `Response to Ticket ${details.ticketNumber}`,
      html,
    });
  }

  /**
   * Send welcome email to newly registered users
   */
  async sendWelcomeEmail(
    to: string,
    details: {
      firstName: string;
      lastName: string;
      userType: 'PARENT' | 'CAREGIVER';
    }
  ) {
    const isCaregiver = details.userType === 'CAREGIVER';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.net';
    const dashboardUrl = isCaregiver
      ? `${baseUrl}/caregiver-dashboard`
      : `${baseUrl}/parent-dashboard`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to InstaCares</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <!-- Wrapper table for full-width background -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <!-- Main container -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">

                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #7dd3c7 0%, #fcd775 50%, #f4a89a 100%); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center;">
                      <!-- InstaCares Logo -->
                      <img src="${baseUrl}/logo-optimized.png" alt="InstaCares" width="120" height="120" style="display: block; margin: 0 auto 15px; width: 120px; height: 120px; object-fit: contain; border-radius: 12px; background: white;" />
                      <h1 style="margin: 0; color: #3D3D4D; font-size: 28px; font-weight: 700; text-shadow: 0 1px 2px rgba(255,255,255,0.3);">Welcome to InstaCares!</h1>
                      <p style="margin: 10px 0 0; color: #4a4a5a; font-size: 16px;">Trusted Childcare Made Simple</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background: white; padding: 40px 35px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

                      <!-- Greeting -->
                      <p style="font-size: 20px; color: #3D3D4D; margin: 0 0 20px; font-weight: 600;">Hi ${details.firstName}!</p>

                      <p style="font-size: 16px; color: #5a5a6a; line-height: 1.7; margin: 0 0 25px;">
                        Thank you for joining <strong style="color: #E8786B;">InstaCares</strong>! We're thrilled to have you as part of our community of ${isCaregiver ? 'trusted caregivers' : 'caring families'}.
                      </p>

                      ${isCaregiver ? `
                      <!-- Caregiver-specific content -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #f0fdf9 0%, #ccfbf1 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #5CBDB7;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #0d9488; font-size: 17px; font-weight: 600;">What happens next?</h3>
                            <ol style="margin: 0; padding-left: 20px; color: #047857; font-size: 15px; line-height: 1.8;">
                              <li style="margin-bottom: 8px;">Our admin team will review your registration</li>
                              <li style="margin-bottom: 8px;">You'll receive an email once approved</li>
                              <li style="margin-bottom: 8px;">Complete your profile with your experience & availability</li>
                              <li style="margin-bottom: 0;">Start connecting with families in your area</li>
                            </ol>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border-radius: 16px; margin: 25px 0;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #3D3D4D; font-size: 15px; font-weight: 600;">As a caregiver, you'll be able to:</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                              <li style="margin-bottom: 6px;">Set your own hourly rate and availability</li>
                              <li style="margin-bottom: 6px;">Accept booking requests from families</li>
                              <li style="margin-bottom: 6px;">Build your reputation with reviews</li>
                              <li style="margin-bottom: 0;">Get paid securely through our platform</li>
                            </ul>
                          </td>
                        </tr>
                      </table>
                      ` : `
                      <!-- Parent-specific content -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fef7e0 0%, #fef3c7 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #F5C857;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #92400e; font-size: 17px; font-weight: 600;">What happens next?</h3>
                            <ol style="margin: 0; padding-left: 20px; color: #b45309; font-size: 15px; line-height: 1.8;">
                              <li style="margin-bottom: 8px;">Our admin team will review your registration</li>
                              <li style="margin-bottom: 8px;">You'll receive an email once approved</li>
                              <li style="margin-bottom: 8px;">Add your children's profiles to your account</li>
                              <li style="margin-bottom: 0;">Start browsing verified caregivers in your area</li>
                            </ol>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f8fafc; border-radius: 16px; margin: 25px 0;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px; color: #3D3D4D; font-size: 15px; font-weight: 600;">As a parent, you'll be able to:</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                              <li style="margin-bottom: 6px;">Browse verified caregivers in your area</li>
                              <li style="margin-bottom: 6px;">Book trusted childcare with confidence</li>
                              <li style="margin-bottom: 6px;">Manage multiple children's profiles</li>
                              <li style="margin-bottom: 0;">Pay securely through our platform</li>
                            </ul>
                          </td>
                        </tr>
                      </table>
                      `}

                      <!-- CTA Button -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="padding: 30px 0;">
                            <!-- Bulletproof Button for Email Clients -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" bgcolor="#E8786B" style="border-radius: 10px;">
                                  <a href="${dashboardUrl}"
                                     target="_blank"
                                     style="display: inline-block; padding: 18px 45px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #E8786B; border: 1px solid #E8786B;">
                                    Go to Your Dashboard
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Divider -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent);"></div>
                          </td>
                        </tr>
                      </table>

                      <!-- Support Section -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding: 20px 0 0; text-align: center;">
                            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">
                              Need help? Our support team is here for you.
                            </p>
                            <p style="font-size: 14px; color: #6b7280; margin: 0;">
                              Contact us at <a href="mailto:support@instacares.net" style="color: #E8786B; text-decoration: none; font-weight: 500;">support@instacares.net</a>
                            </p>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px; text-align: center;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center">
                            <p style="color: #3D3D4D; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
                              InstaCares
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px;">
                              Trusted Childcare Platform
                            </p>
                            <p style="color: #b0b0b0; font-size: 11px; margin: 15px 0 0;">
                              You received this email because you registered for an InstaCares account.
                            </p>
                            <p style="color: #b0b0b0; font-size: 11px; margin: 5px 0 0;">
                              &copy; ${new Date().getFullYear()} InstaCares. All rights reserved.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    return this.send({
      to,
      subject: `Welcome to InstaCares, ${details.firstName}!`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();