import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const addResponseSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5000 characters or less'),
  isInternal: z.boolean().optional().default(false),
  attachments: z.any().optional(),
});

// POST - Add a response to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { ticketId } = await params;
    const body = await request.json();
    const parsed = addResponseSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { message, isInternal, attachments } = parsed.data;

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Get ticket
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return ApiErrors.notFound('Ticket not found');
    }

    // Non-admins can only respond to their own tickets
    if (!isAdmin && ticket.userId !== session.user.id) {
      return ApiErrors.forbidden('Not authorized');
    }

    // Only admins can create internal notes
    const internal = isAdmin && isInternal === true;

    // Create response and update ticket status
    const [response, updatedTicket] = await db.$transaction([
      db.ticketResponse.create({
        data: {
          ticketId,
          responderId: session.user.id,
          message: message.trim(),
          isInternal: internal,
          attachments: attachments || null
        }
      }),
      db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: isAdmin ? 'AWAITING_USER' : 'AWAITING_ADMIN',
          updatedAt: new Date()
        }
      })
    ]);

    logger.info(`Response added to ticket ${ticket.ticketNumber} by ${session.user.id}`);

    return apiSuccess(response);
  } catch (error) {
    logger.error('Error adding ticket response:', error);
    return ApiErrors.internal('Failed to add response');
  }
}

// GET - Get all responses for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { ticketId } = await params;

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Get ticket to verify access
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return ApiErrors.notFound('Ticket not found');
    }

    // Non-admins can only view their own tickets
    if (!isAdmin && ticket.userId !== session.user.id) {
      return ApiErrors.forbidden('Not authorized');
    }

    const responses = await db.ticketResponse.findMany({
      where: {
        ticketId,
        // Non-admins don't see internal notes
        ...(isAdmin ? {} : { isInternal: false })
      },
      orderBy: { createdAt: 'asc' }
    });

    return apiSuccess(responses);
  } catch (error) {
    logger.error('Error fetching ticket responses:', error);
    return ApiErrors.internal('Failed to fetch responses');
  }
}
