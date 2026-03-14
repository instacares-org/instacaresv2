import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

const ticketCategories = [
  'BOOKING_ISSUE',
  'PAYMENT_ISSUE',
  'REFUND_REQUEST',
  'CAREGIVER_NO_SHOW',
  'PARENT_NO_SHOW',
  'ACCOUNT_ISSUE',
  'TECHNICAL_ISSUE',
  'SAFETY_CONCERN',
  'COMPLAINT',
  'GENERAL_INQUIRY',
  'OTHER',
] as const;

const createTicketSchema = z.object({
  category: z.enum(ticketCategories),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description must be 5000 characters or less'),
  bookingId: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
  attachments: z.any().optional(),
});

// Generate ticket number
function generateTicketNumber(): string {
  const prefix = 'TKT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET - List tickets for user or all tickets for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Build where clause
    const where: any = {};

    // Non-admins can only see their own tickets
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              userType: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              }
            }
          },
          booking: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true
            }
          },
          responses: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      db.supportTicket.count({ where })
    ]);

    return apiSuccess({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    return ApiErrors.internal('Failed to fetch tickets');
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return ApiErrors.tooManyRequests('Too many requests. Please try again later.');
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { category, subject, description, bookingId, priority, attachments } = parsed.data;

    // Get user type
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    // If bookingId provided, verify it belongs to the user
    if (bookingId) {
      const booking = await db.booking.findFirst({
        where: {
          id: bookingId,
          OR: [
            { parentId: session.user.id },
            { caregiverId: session.user.id }
          ]
        }
      });

      if (!booking) {
        return ApiErrors.notFound('Booking not found or not authorized');
      }
    }

    // Create ticket
    const ticket = await db.supportTicket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        userId: session.user.id,
        userType: user.userType,
        category,
        subject,
        description,
        bookingId: bookingId || null,
        priority: priority || 'NORMAL',
        attachments: attachments || null,
        status: 'OPEN'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true
          }
        }
      }
    });

    logger.info(`Support ticket created: ${ticket.ticketNumber} by user ${session.user.id}`);

    return apiSuccess(ticket, `Ticket ${ticket.ticketNumber} created successfully`);
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return ApiErrors.internal('Failed to create ticket');
  }
}
