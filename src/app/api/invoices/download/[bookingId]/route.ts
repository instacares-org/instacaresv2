/**
 * Invoice Download API
 * Generates and downloads invoice PDFs for bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/db';
import { createInvoiceData, generateInvoiceHTML } from '@/lib/notifications/invoice.service';
import { generatePdfFromHtml } from '@/lib/notifications/pdf.service';
import { verifyDownloadToken } from '@/lib/signed-url';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    let type: 'parent' | 'caregiver';

    if (token) {
      // --- SIGNED TOKEN AUTH (from email links) ---
      const tokenData = verifyDownloadToken(token);
      if (!tokenData) {
        return ApiErrors.unauthorized('Download link has expired or is invalid. Please log in to download.');
      }
      if (tokenData.bookingId !== bookingId) {
        return ApiErrors.forbidden('Invalid download link');
      }
      type = tokenData.type;
    } else {
      // --- SESSION AUTH (from dashboard) ---
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return ApiErrors.unauthorized();
      }

      type = searchParams.get('type') as 'parent' | 'caregiver' || 'parent';

      if (!['parent', 'caregiver'].includes(type)) {
        return ApiErrors.badRequest('Invalid invoice type. Must be "parent" or "caregiver"');
      }

      // Fetch booking to check authorization
      const bookingForAuth = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { parentId: true, caregiverId: true },
      });

      if (!bookingForAuth) {
        return ApiErrors.notFound('Booking not found');
      }

      const isParent = bookingForAuth.parentId === session.user.id;
      const isCaregiver = bookingForAuth.caregiverId === session.user.id;
      const adminUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { userType: true }
      });
      const isAdmin = adminUser?.userType === 'ADMIN';

      if (!isParent && !isCaregiver && !isAdmin) {
        return ApiErrors.forbidden('You do not have permission to download this invoice');
      }
    }

    // Validate type
    if (!['parent', 'caregiver'].includes(type)) {
      return ApiErrors.badRequest('Invalid invoice type');
    }

    // Fetch booking with related data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        parent: {
          include: { profile: true },
        },
        caregiverUser: {
          include: { profile: true },
        },
      },
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    // Calculate duration from DateTime fields
    const startDateTime = new Date(booking.startTime);
    const endDateTime = new Date(booking.endTime);
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const duration = durationMs / (1000 * 60 * 60); // Convert to hours

    // Format times
    const startTimeStr = startDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const endTimeStr = endDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Format names
    const parentName = booking.parent?.profile
      ? `${booking.parent.profile.firstName || ''} ${booking.parent.profile.lastName || ''}`.trim()
      : 'Parent';
    const caregiverName = booking.caregiverUser?.profile
      ? `${booking.caregiverUser.profile.firstName || ''} ${booking.caregiverUser.profile.lastName || ''}`.trim()
      : 'Caregiver';

    // Format date from startTime
    const bookingDate = startDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create invoice data
    // Note: totalAmount and platformFee are already stored in cents in the database
    const invoiceData = createInvoiceData(type, {
      id: booking.id,
      parentName,
      caregiverName,
      date: bookingDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      childrenCount: booking.childrenCount || 1,
      totalAmount: Number(booking.totalAmount), // Already in cents
      platformFee: Number(booking.platformFee || 0), // Already in cents
    });

    // Generate HTML
    const invoiceHtml = generateInvoiceHTML(invoiceData);

    // Try to generate PDF
    try {
      const pdfBuffer = await generatePdfFromHtml(invoiceHtml);

      const filename = type === 'parent'
        ? `InstaCares_Invoice_${bookingId.substring(0, 8)}.pdf`
        : `InstaCares_Payout_Statement_${bookingId.substring(0, 8)}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (pdfError) {
      console.error('PDF generation failed, returning HTML:', pdfError);

      // Fallback to HTML download if PDF generation fails
      const filename = type === 'parent'
        ? `InstaCares_Invoice_${bookingId.substring(0, 8)}.html`
        : `InstaCares_Payout_Statement_${bookingId.substring(0, 8)}.html`;

      return new NextResponse(invoiceHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error('Invoice download error:', error);
    return ApiErrors.internal('Failed to generate invoice');
  }
}
