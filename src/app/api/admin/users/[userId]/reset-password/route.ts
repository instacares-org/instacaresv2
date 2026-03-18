import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { emailService } from '@/lib/notifications/email.service';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .optional(),
});

// POST /api/admin/users/[userId]/reset-password - Reset user password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin authentication and permission
    const permCheck = await requirePermission(request, 'canManageUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const { userId } = await params;

    // Check if target user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      }
    });

    if (!targetUser) {
      return ApiErrors.notFound('User not found');
    }

    // Parse and validate optional request body
    let newPassword: string | undefined;
    try {
      const body = await request.json();
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
      }
      newPassword = parsed.data.newPassword;
    } catch {
      // No body provided, which is fine - we'll generate a password
    }

    // Use provided password or generate a temporary one
    const tempPassword = newPassword || Array.from(
      crypto.getRandomValues(new Uint8Array(20)),
      (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'[b % 72]
    ).join('');

    // Hash the password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update user password
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        mustChangePassword: true,
      }
    });

    // Send temporary password via email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.com';
    const userName = targetUser.profile?.firstName || 'User';
    const emailResult = await emailService.send({
      to: targetUser.email,
      subject: 'Your InstaCares Password Has Been Reset',
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;">
              <tr><td align="center" style="padding:40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#7dd3c7 0%,#fcd775 50%,#f4a89a 100%);border-radius:20px 20px 0 0;padding:40px 30px;text-align:center;">
                      <img src="${baseUrl}/logo-optimized.png" alt="InstaCares" width="80" height="80" style="display:block;margin:0 auto 15px;width:80px;height:80px;object-fit:contain;border-radius:12px;background:white;" />
                      <h1 style="margin:0;color:#3D3D4D;font-size:24px;font-weight:700;">Password Reset</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:white;padding:40px 35px;border-radius:0 0 20px 20px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                      <p style="font-size:18px;color:#3D3D4D;margin:0 0 20px;font-weight:600;">Hi ${userName},</p>
                      <p style="font-size:15px;color:#5a5a6a;line-height:1.7;margin:0 0 25px;">
                        Your password has been reset by an administrator. Please use the temporary password below to log in, then change it immediately.
                      </p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf9;border-radius:12px;margin:25px 0;border-left:4px solid #5CBDB7;">
                        <tr><td style="padding:20px 25px;">
                          <p style="margin:0 0 8px;color:#047857;font-size:13px;font-weight:600;">Your Temporary Password:</p>
                          <p style="margin:0;color:#065f46;font-size:20px;font-weight:700;font-family:monospace;letter-spacing:1px;">${tempPassword}</p>
                        </td></tr>
                      </table>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fef2f2;border-radius:12px;margin:25px 0;border-left:4px solid #ef4444;">
                        <tr><td style="padding:15px 20px;">
                          <p style="margin:0;color:#991b1b;font-size:13px;">Please change your password after logging in. Do not share this password with anyone.</p>
                        </td></tr>
                      </table>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr><td align="center" bgcolor="#5CBDB7" style="border-radius:10px;">
                          <a href="${baseUrl}/login" target="_blank" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#5CBDB7;">
                            Log In Now
                          </a>
                        </td></tr>
                      </table>
                      <p style="margin:30px 0 0;text-align:center;color:#9ca3af;font-size:12px;">If you didn't expect this reset, contact <a href="mailto:support@instacares.com" style="color:#5CBDB7;">support@instacares.com</a></p>
                    </td>
                  </tr>
                  <tr><td style="padding:20px;text-align:center;">
                    <p style="color:#b0b0b0;font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} InstaCares. All rights reserved.</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `,
    });

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: AuditActions.USER_PASSWORD_RESET,
      resource: 'user',
      resourceId: userId,
      details: { targetEmail: targetUser.email, emailSent: emailResult.success },
      request,
    });

    return apiSuccess({
      emailSent: emailResult.success,
      email: targetUser.email,
    }, 'Password reset successfully. Temporary password sent via email.');

  } catch (error) {
    console.error('Error resetting password:', error);
    return ApiErrors.internal('Failed to reset password');
  }
}
