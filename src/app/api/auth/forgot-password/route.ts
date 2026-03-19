export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { generateSecureToken } from '@/lib/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid email address');
    }

    const { email } = parsed.data;

    // Always return success to avoid revealing whether an email exists
    const successResponse = apiSuccess({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });

    // Look up user by email
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      // Return same success response whether user exists or not
      return successResponse;
    }

    // Delete any existing unused reset tokens for this user
    await db.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // Generate a secure token
    const rawToken = generateSecureToken(64);

    // Hash the token with SHA-256 before storing
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Create the PasswordResetToken record (expires in 1 hour)
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send the password reset email
    try {
      const { emailService } = await import('@/lib/notifications/email.service');
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.com';
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      await emailService.send({
        to: user.email,
        subject: 'Reset Your InstaCares Password',
        html: buildPasswordResetEmail(baseUrl, resetUrl, user.name || 'there'),
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't fail the request if email fails -- token is still stored
    }

    return successResponse;
  } catch (error) {
    console.error('Forgot password error:', error);
    return ApiErrors.internal('An unexpected error occurred');
  }
}

function buildPasswordResetEmail(baseUrl: string, resetUrl: string, userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
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
                    <h1 style="margin: 0; color: #3D3D4D; font-size: 28px; font-weight: 700;">Reset Your Password</h1>
                    <p style="margin: 10px 0 0; color: #4a4a5a; font-size: 16px;">We received a password reset request</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background: white; padding: 40px 35px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

                    <p style="font-size: 20px; color: #3D3D4D; margin: 0 0 20px; font-weight: 600;">Hi ${userName}!</p>

                    <p style="font-size: 16px; color: #5a5a6a; line-height: 1.7; margin: 0 0 25px;">
                      We received a request to reset the password for your <strong style="color: #5CBDB7;">InstaCares</strong> account. Click the button below to set a new password.
                    </p>

                    <!-- Reset Button -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                            <tr>
                              <td align="center" bgcolor="#5CBDB7" style="border-radius: 10px;">
                                <a href="${resetUrl}"
                                   target="_blank"
                                   style="display: inline-block; padding: 18px 45px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #5CBDB7; border: 1px solid #5CBDB7;">
                                  Reset My Password
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry Notice -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fef7e0 0%, #fef3c7 100%); border-radius: 16px; margin: 25px 0; border-left: 4px solid #F5C857;">
                      <tr>
                        <td style="padding: 20px 25px;">
                          <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                            This link expires in 1 hour.
                          </p>
                          <p style="margin: 8px 0 0; color: #b45309; font-size: 14px;">
                            If the button doesn't work, copy and paste this link into your browser:
                          </p>
                          <p style="margin: 8px 0 0; word-break: break-all;">
                            <a href="${resetUrl}" style="color: #5CBDB7; font-size: 13px; text-decoration: none;">${resetUrl}</a>
                          </p>
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

                    <!-- Safety Notice -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 20px 0 0; text-align: center;">
                          <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">
                            If you didn't request a password reset, you can safely ignore this email.
                          </p>
                          <p style="font-size: 14px; color: #6b7280; margin: 0;">
                            Your password will remain unchanged.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Support -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 20px 0 0; text-align: center;">
                          <p style="font-size: 14px; color: #6b7280; margin: 0;">
                            Need help? Contact us at <a href="mailto:support@instacares.com" style="color: #5CBDB7; text-decoration: none; font-weight: 500;">support@instacares.com</a>
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
}
