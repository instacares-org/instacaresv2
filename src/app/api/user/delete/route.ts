import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { logger, getClientInfo } from '@/lib/logger';
import { unlink } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/delete
 *
 * PIPEDA-compliant account deletion endpoint.
 * Permanently deletes the authenticated user and all associated data.
 *
 * Requires the user to confirm by sending their email address in the request
 * body. This prevents accidental deletions and CSRF-style abuse.
 *
 * Deletion order respects foreign key constraints:
 *   1. Remove uploaded files from disk (best-effort)
 *   2. Delete non-cascading child records in dependency order
 *   3. Delete the User row (cascades handle the rest)
 */
export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------ Auth
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response || ApiErrors.unauthorized();
    }

    const userId = authResult.user.id;
    const userEmail = authResult.user.email;
    const clientInfo = getClientInfo(request);

    // -------------------------------------------------------------- Body
    let body: { confirmEmail?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.badRequest('Invalid JSON body');
    }

    const { confirmEmail } = body;
    if (!confirmEmail || confirmEmail !== userEmail) {
      return ApiErrors.badRequest('Email confirmation does not match');
    }

    // --------------------------------------------------------- Safety: admin lockout
    if (authResult.user.userType === 'ADMIN') {
      return ApiErrors.forbidden(
        'Admin accounts cannot be self-deleted. Contact another administrator.'
      );
    }

    // --------------------------------------------------------- Safety: active bookings
    // Check for in-progress caregiver bookings (standard bookings)
    const activeBookings = await db.booking.findFirst({
      where: {
        OR: [
          { parentId: userId, status: 'IN_PROGRESS' },
          { caregiverId: userId, status: 'IN_PROGRESS' },
        ],
      },
      select: { id: true },
    });

    if (activeBookings) {
      return ApiErrors.badRequest(
        'Cannot delete account while you have an active booking in progress. ' +
        'Please wait for the booking to complete or cancel it first.'
      );
    }

    // Check for in-progress babysitter bookings
    const activeBabysitterBookings = await db.babysitterBooking.findFirst({
      where: {
        OR: [
          { parentId: userId, status: 'IN_PROGRESS' },
          { babysitter: { userId }, status: 'IN_PROGRESS' },
        ],
      },
      select: { id: true },
    });

    if (activeBabysitterBookings) {
      return ApiErrors.badRequest(
        'Cannot delete account while you have an active babysitter booking in progress. ' +
        'Please wait for the booking to complete or cancel it first.'
      );
    }

    // --------------------------------------------------- Collect file paths to delete
    // Gather all file URLs before the transaction so we can clean up the
    // filesystem afterwards. We do this outside the transaction because file
    // I/O should not hold the DB lock open.
    const filePaths: string[] = [];

    // User avatar
    const userProfile = await db.userProfile.findUnique({
      where: { userId },
      select: { avatar: true },
    });
    if (userProfile?.avatar) {
      filePaths.push(userProfile.avatar);
    }

    // User image on the User model itself
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    if (userRecord?.image) {
      filePaths.push(userRecord.image);
    }

    // Caregiver photos
    const caregiver = await db.caregiver.findUnique({
      where: { userId },
      select: {
        id: true,
        photos: { select: { url: true } },
        certifications: { select: { certificateUrl: true } },
        verification: {
          select: {
            idDocumentUrl: true,
            backgroundCheckReportUrl: true,
            insuranceDocumentUrl: true,
          },
        },
      },
    });

    if (caregiver) {
      for (const photo of caregiver.photos) {
        if (photo.url) filePaths.push(photo.url);
      }
      for (const cert of caregiver.certifications) {
        if (cert.certificateUrl) filePaths.push(cert.certificateUrl);
      }
      if (caregiver.verification) {
        if (caregiver.verification.idDocumentUrl) {
          filePaths.push(caregiver.verification.idDocumentUrl);
        }
        if (caregiver.verification.backgroundCheckReportUrl) {
          filePaths.push(caregiver.verification.backgroundCheckReportUrl);
        }
        if (caregiver.verification.insuranceDocumentUrl) {
          filePaths.push(caregiver.verification.insuranceDocumentUrl);
        }
      }
    }

    // Babysitter documents
    const babysitter = await db.babysitter.findUnique({
      where: { userId },
      select: {
        id: true,
        governmentIdFront: true,
        governmentIdBack: true,
        policeCheck: true,
        selfieForMatch: true,
        cprCertificate: true,
        eceCertificate: true,
      },
    });

    if (babysitter) {
      const babysitterDocs = [
        babysitter.governmentIdFront,
        babysitter.governmentIdBack,
        babysitter.policeCheck,
        babysitter.selfieForMatch,
        babysitter.cprCertificate,
        babysitter.eceCertificate,
      ];
      for (const doc of babysitterDocs) {
        if (doc) filePaths.push(doc);
      }
    }

    // Child photos
    const children = await db.child.findMany({
      where: { parentId: userId },
      select: { photoUrl: true },
    });
    for (const child of children) {
      if (child.photoUrl) filePaths.push(child.photoUrl);
    }

    // Check-in/out photos (user might be parent or caregiver)
    const checkInOutPhotos = await db.checkInOut.findMany({
      where: {
        OR: [
          { booking: { parentId: userId } },
          { booking: { caregiverId: userId } },
        ],
      },
      select: { checkInPhotoUrl: true, checkOutPhotoUrl: true },
    });
    for (const cio of checkInOutPhotos) {
      if (cio.checkInPhotoUrl) filePaths.push(cio.checkInPhotoUrl);
      if (cio.checkOutPhotoUrl) filePaths.push(cio.checkOutPhotoUrl);
    }

    // --------------------------------------------------- Transactional deletion
    // Use a long timeout (30 s) because this touches many tables.
    await db.$transaction(
      async (tx) => {
        // ==============================================================
        // PHASE 1 - Delete non-cascading relations (manual cleanup)
        //
        // These models reference User but do NOT have onDelete: Cascade,
        // so Prisma/Postgres will refuse to delete the User until these
        // foreign-key references are removed.
        // ==============================================================

        // --- Babysitter ecosystem (BabysitterBooking -> parentId has no cascade) ---
        // Get all babysitter booking IDs where the user is a parent
        const parentBabysitterBookings = await tx.babysitterBooking.findMany({
          where: { parentId: userId },
          select: { id: true },
        });
        const parentBabysitterBookingIds = parentBabysitterBookings.map((b) => b.id);

        // Get babysitter booking IDs where user is the babysitter
        let babysitterBabysitterBookingIds: string[] = [];
        if (babysitter) {
          const bsBookings = await tx.babysitterBooking.findMany({
            where: { babysitterId: babysitter.id },
            select: { id: true },
          });
          babysitterBabysitterBookingIds = bsBookings.map((b) => b.id);
        }

        const allBabysitterBookingIds = Array.from(
          new Set([...parentBabysitterBookingIds, ...babysitterBabysitterBookingIds])
        );

        if (allBabysitterBookingIds.length > 0) {
          // BabysitterMessage -> via BabysitterChatRoom (cascade from chatRoom)
          // BabysitterChatRoom -> bookingId cascade, but we delete explicitly to be safe
          await tx.babysitterChatRoom.deleteMany({
            where: { bookingId: { in: allBabysitterBookingIds } },
          });

          // BabysitterReview -> bookingId (no cascade from booking)
          await tx.babysitterReview.deleteMany({
            where: { bookingId: { in: allBabysitterBookingIds } },
          });

          // BabysitterBooking itself
          await tx.babysitterBooking.deleteMany({
            where: { id: { in: allBabysitterBookingIds } },
          });
        }

        // --- Standard Booking ecosystem ---
        // Get all booking IDs where user is parent or caregiver
        const userBookings = await tx.booking.findMany({
          where: {
            OR: [{ parentId: userId }, { caregiverId: userId }],
          },
          select: { id: true },
        });
        const bookingIds = userBookings.map((b) => b.id);

        if (bookingIds.length > 0) {
          // Cancellation -> cancelledByUserId (no cascade from user)
          // Also cancellation -> bookingId (no cascade from booking)
          await tx.cancellation.deleteMany({
            where: {
              OR: [
                { cancelledByUserId: userId },
                { bookingId: { in: bookingIds } },
              ],
            },
          });

          // SupportTicket -> userId (no cascade), also linked to bookings
          // First delete TicketResponse (cascades from ticket, but let's be explicit)
          const tickets = await tx.supportTicket.findMany({
            where: {
              OR: [
                { userId },
                { bookingId: { in: bookingIds } },
              ],
            },
            select: { id: true },
          });
          const ticketIds = tickets.map((t) => t.id);

          if (ticketIds.length > 0) {
            await tx.ticketResponse.deleteMany({
              where: { ticketId: { in: ticketIds } },
            });
            await tx.supportTicket.deleteMany({
              where: { id: { in: ticketIds } },
            });
          }

          // Review -> revieweeId / reviewerId (no cascade from user)
          await tx.review.deleteMany({
            where: {
              OR: [
                { reviewerId: userId },
                { revieweeId: userId },
              ],
            },
          });

          // Message -> senderId (no cascade from user)
          // Messages cascade from ChatRoom, but senderId FK would block user delete
          await tx.message.deleteMany({
            where: { senderId: userId },
          });

          // ChatRoom -> parentId / caregiverId (no cascade from user)
          // Messages cascade from ChatRoom delete, but we already cleaned senderId above
          await tx.chatRoom.deleteMany({
            where: {
              OR: [{ parentId: userId }, { caregiverId: userId }],
            },
          });

          // BookingReservation -> parentId (no cascade from user)
          await tx.bookingReservation.deleteMany({
            where: { parentId: userId },
          });

          // Booking -> parentId / caregiverId (no cascade from user)
          // SlotBooking, BookingExtension, CheckInOut, Payment, Invoice cascade from Booking
          // ChatRoom was already deleted above
          // Review was already deleted above
          // Cancellation was already deleted above
          // SupportTicket was already deleted above
          await tx.booking.deleteMany({
            where: {
              OR: [{ parentId: userId }, { caregiverId: userId }],
            },
          });
        } else {
          // Even if no bookings, there might be orphaned support tickets,
          // reviews, messages, cancellations, or reservations
          const tickets = await tx.supportTicket.findMany({
            where: { userId },
            select: { id: true },
          });
          const ticketIds = tickets.map((t) => t.id);

          if (ticketIds.length > 0) {
            await tx.ticketResponse.deleteMany({
              where: { ticketId: { in: ticketIds } },
            });
            await tx.supportTicket.deleteMany({
              where: { id: { in: ticketIds } },
            });
          }

          await tx.review.deleteMany({
            where: { OR: [{ reviewerId: userId }, { revieweeId: userId }] },
          });

          await tx.message.deleteMany({
            where: { senderId: userId },
          });

          await tx.chatRoom.deleteMany({
            where: { OR: [{ parentId: userId }, { caregiverId: userId }] },
          });

          await tx.bookingReservation.deleteMany({
            where: { parentId: userId },
          });

          await tx.cancellation.deleteMany({
            where: { cancelledByUserId: userId },
          });
        }

        // ManualPayout -> caregiverId (no cascade from user)
        await tx.manualPayout.deleteMany({
          where: { caregiverId: userId },
        });

        // CaregiverWarning -> caregiverId references Caregiver (no cascade)
        // Must delete before Caregiver is cascade-deleted
        if (caregiver) {
          await tx.caregiverWarning.deleteMany({
            where: { caregiverId: caregiver.id },
          });
        }

        // BabysitterReview -> babysitterId references Babysitter (no cascade)
        // Must delete before Babysitter is cascade-deleted (some may remain
        // from bookings where this user was the babysitter but the booking
        // was owned by another parent -- already handled above, but be safe)
        if (babysitter) {
          await tx.babysitterReview.deleteMany({
            where: { babysitterId: babysitter.id },
          });
        }

        // ==============================================================
        // PHASE 2 - Delete the User (cascades handle the rest)
        //
        // The following are deleted automatically via onDelete: Cascade:
        //   UserProfile, Account, Session, SupervisorPermission,
        //   Caregiver (-> CaregiverCertification, CaregiverService,
        //              CaregiverPhoto, CaregiverVerification, AvailabilitySlot),
        //   Babysitter (-> BabysitterReference, BabysitterAvailability),
        //   Child (-> CheckInOut), EmergencyContact,
        //   Notification, NotificationPreferences
        // ==============================================================
        await tx.user.delete({
          where: { id: userId },
        });
      },
      {
        timeout: 30000, // 30 seconds for complex multi-table deletion
      }
    );

    // --------------------------------------------------- File cleanup (best-effort)
    // Run after the transaction so DB changes are committed even if file
    // deletion partially fails. Missing files are silently ignored.
    const fileDeleteResults = { deleted: 0, failed: 0, skipped: 0 };

    for (const fileUrl of filePaths) {
      try {
        // Normalise the path: URLs stored in the database may be relative
        // (e.g. "/uploads/avatars/abc.jpg") or absolute filesystem paths.
        let absolutePath: string;

        if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
          // Relative to the public directory
          const relativePart = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
          absolutePath = path.join(process.cwd(), 'public', relativePart);
        } else if (fileUrl.startsWith('public/uploads/')) {
          absolutePath = path.join(process.cwd(), fileUrl);
        } else if (path.isAbsolute(fileUrl)) {
          absolutePath = fileUrl;
        } else {
          // Unknown format -- skip but log
          fileDeleteResults.skipped++;
          continue;
        }

        await unlink(absolutePath);
        fileDeleteResults.deleted++;
      } catch (err: unknown) {
        // ENOENT means the file was already gone -- not an error
        const isNotFound =
          err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
        if (isNotFound) {
          fileDeleteResults.skipped++;
        } else {
          fileDeleteResults.failed++;
          logger.warn('Failed to delete user file during account deletion', {
            filePath: fileUrl,
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // --------------------------------------------------- Audit log
    logger.security('User account deleted', {
      userId,
      email: userEmail,
      filesDeleted: fileDeleteResults.deleted,
      filesFailed: fileDeleteResults.failed,
      filesSkipped: fileDeleteResults.skipped,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    return apiSuccess(
      { deletedAt: new Date().toISOString() },
      'Your account and all associated data have been permanently deleted.'
    );
  } catch (error) {
    logger.error('Account deletion failed', error, {
      action: 'user_delete',
    });

    // Surface Prisma constraint errors with a human-readable message
    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint')
    ) {
      return ApiErrors.badRequest(
        'Account deletion failed due to a data dependency. ' +
        'Please contact support for assistance.'
      );
    }

    return ApiErrors.internal('Account deletion failed. Please try again or contact support.');
  }
}
