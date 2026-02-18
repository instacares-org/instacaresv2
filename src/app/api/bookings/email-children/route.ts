import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { emailService } from '@/lib/notifications/email.service';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender?: string;
  allergies?: string[];
  medications?: string[];
  medicalConditions?: string[];
  emergencyMedicalInfo?: string;
  bloodType?: string;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  dietaryRestrictions?: string[];
  specialInstructions?: string;
  pickupInstructions?: string;
}

// POST /api/bookings/email-children - Email children info to the caregiver
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    const { bookingId, parentName, children } = await request.json();

    if (!bookingId || !children || children.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the booking to verify access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        parentId: true,
        caregiverId: true,
      }
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Security: Only allow the parent or caregiver of this booking
    const authUser = authResult.user!;
    const isParent = authUser.id === booking.parentId;
    const isCaregiver = authUser.id === booking.caregiverId;
    const isAdmin = authUser.userType === 'ADMIN';

    if (!isParent && !isCaregiver && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get the user's email
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { email: true, profile: true }
    });

    if (!user?.email) {
      return NextResponse.json(
        { success: false, error: 'User email not found' },
        { status: 400 }
      );
    }

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Generate HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Children Information - ${parentName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; background: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { opacity: 0.9; font-size: 14px; }
            .content { padding: 30px; }
            .child-card { margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
            .child-header { background: #f3f4f6; padding: 15px 20px; border-bottom: 1px solid #e5e7eb; }
            .child-header h2 { font-size: 18px; color: #111827; margin-bottom: 3px; }
            .child-header p { color: #6b7280; font-size: 13px; }
            .child-body { padding: 20px; }
            .section { margin-bottom: 20px; }
            .section:last-child { margin-bottom: 0; }
            .section-title { font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid; }
            .section-title.medical { color: #dc2626; border-color: #fecaca; }
            .section-title.care { color: #059669; border-color: #a7f3d0; }
            .section-title.emergency { color: #2563eb; border-color: #bfdbfe; }
            .info-row { margin-bottom: 8px; }
            .info-label { font-weight: 500; color: #6b7280; font-size: 12px; display: block; margin-bottom: 2px; }
            .info-value { color: #111827; font-size: 14px; }
            .tags { margin-top: 5px; }
            .tag { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px; }
            .tag.allergy { background: #fee2e2; color: #991b1b; }
            .tag.medication { background: #ffedd5; color: #9a3412; }
            .tag.condition { background: #fef3c7; color: #92400e; }
            .tag.dietary { background: #d1fae5; color: #065f46; }
            .emergency-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 10px; }
            .emergency-box strong { color: #991b1b; font-size: 12px; display: block; margin-bottom: 5px; }
            .emergency-box p { color: #7f1d1d; font-size: 13px; }
            .contact-card { background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 10px; }
            .contact-card:last-child { margin-bottom: 0; }
            .contact-card .name { font-weight: 600; color: #111827; font-size: 14px; }
            .contact-card .relationship { font-size: 12px; color: #6b7280; }
            .contact-card .phone { color: #2563eb; font-size: 14px; margin-top: 5px; }
            .footer { text-align: center; padding: 20px; border-top: 1px solid #e5e7eb; background: #f9fafb; }
            .footer p { color: #9ca3af; font-size: 12px; }
            .footer .brand { color: #3b82f6; font-weight: 600; }
            .no-info { color: #9ca3af; font-style: italic; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Children Information</h1>
              <p>${parentName}'s Children</p>
            </div>
            <div class="content">
              ${(children as Child[]).map(child => `
                <div class="child-card">
                  <div class="child-header">
                    <h2>${child.firstName} ${child.lastName}</h2>
                    <p>${child.age} years old${child.gender ? ` • ${child.gender}` : ''} • Born ${formatDate(child.dateOfBirth)}</p>
                  </div>
                  <div class="child-body">
                    <div class="section">
                      <div class="section-title medical">Medical Information</div>
                      ${child.bloodType ? `
                        <div class="info-row">
                          <span class="info-label">Blood Type</span>
                          <span class="info-value">${child.bloodType}</span>
                        </div>
                      ` : ''}
                      ${child.allergies && child.allergies.length > 0 ? `
                        <div class="info-row">
                          <span class="info-label">Allergies</span>
                          <div class="tags">
                            ${child.allergies.map(a => `<span class="tag allergy">${a}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                      ${child.medications && child.medications.length > 0 ? `
                        <div class="info-row">
                          <span class="info-label">Medications</span>
                          <div class="tags">
                            ${child.medications.map(m => `<span class="tag medication">${m}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                      ${child.medicalConditions && child.medicalConditions.length > 0 ? `
                        <div class="info-row">
                          <span class="info-label">Medical Conditions</span>
                          <div class="tags">
                            ${child.medicalConditions.map(c => `<span class="tag condition">${c}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                      ${child.emergencyMedicalInfo ? `
                        <div class="emergency-box">
                          <strong>Emergency Medical Info</strong>
                          <p>${child.emergencyMedicalInfo}</p>
                        </div>
                      ` : ''}
                      ${!child.bloodType && (!child.allergies || child.allergies.length === 0) && (!child.medications || child.medications.length === 0) && (!child.medicalConditions || child.medicalConditions.length === 0) && !child.emergencyMedicalInfo ? '<p class="no-info">No medical information provided</p>' : ''}
                    </div>

                    <div class="section">
                      <div class="section-title care">Care Instructions</div>
                      ${child.dietaryRestrictions && child.dietaryRestrictions.length > 0 ? `
                        <div class="info-row">
                          <span class="info-label">Dietary Restrictions</span>
                          <div class="tags">
                            ${child.dietaryRestrictions.map(d => `<span class="tag dietary">${d}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                      ${child.specialInstructions ? `
                        <div class="info-row">
                          <span class="info-label">Special Instructions</span>
                          <span class="info-value">${child.specialInstructions}</span>
                        </div>
                      ` : ''}
                      ${child.pickupInstructions ? `
                        <div class="info-row">
                          <span class="info-label">Pickup Instructions</span>
                          <span class="info-value">${child.pickupInstructions}</span>
                        </div>
                      ` : ''}
                      ${(!child.dietaryRestrictions || child.dietaryRestrictions.length === 0) && !child.specialInstructions && !child.pickupInstructions ? '<p class="no-info">No special care instructions provided</p>' : ''}
                    </div>

                    ${child.emergencyContacts && child.emergencyContacts.length > 0 ? `
                      <div class="section">
                        <div class="section-title emergency">Emergency Contacts</div>
                        ${child.emergencyContacts.map(contact => `
                          <div class="contact-card">
                            <div class="name">${contact.name}</div>
                            <div class="relationship">${contact.relationship}</div>
                            <div class="phone">${contact.phone}</div>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="footer">
              <p><span class="brand">InstaCares</span> - Trusted Childcare Platform</p>
              <p>This information is confidential and for caregiver use only.</p>
              <p style="margin-top: 10px;">Sent on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using the existing email service
    const result = await emailService.send({
      to: user.email,
      subject: `Children Information - ${parentName}`,
      html: emailHtml,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });

  } catch (error) {
    console.error('Error sending children email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
