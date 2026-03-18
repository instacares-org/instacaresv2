import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const directRoomSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/find-or-create-direct
 * Find or create a direct chat room between a parent and a caregiver/babysitter
 * (no booking required)
 */
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);

  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Only parents can initiate direct messages
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized direct chat attempt', {
        endpoint: '/api/chat/rooms/find-or-create-direct',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;
    const body = await request.json();
    const parsed = directRoomSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { providerId } = parsed.data;

    // Prevent self-messaging
    if (providerId === user.id) {
      return ApiErrors.badRequest('Cannot message yourself');
    }

    // Verify provider exists, is active, and is a caregiver or babysitter
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      include: { profile: true },
    });

    if (!provider || !provider.isActive) {
      return ApiErrors.notFound('Provider not found');
    }

    if (!provider.isCaregiver && !provider.isBabysitter) {
      return ApiErrors.badRequest('User is not a caregiver or babysitter');
    }

    // Find existing direct room between this parent and provider
    let chatRoom = await prisma.chatRoom.findFirst({
      where: {
        parentId: user.id,
        caregiverId: providerId,
        roomType: 'DIRECT',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { include: { profile: true } },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: user.id },
                isRead: false,
              },
            },
          },
        },
      },
    });

    // Create if not found
    if (!chatRoom) {
      chatRoom = await prisma.chatRoom.create({
        data: {
          roomType: 'DIRECT',
          parentId: user.id,
          caregiverId: providerId,
          isActive: true,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { include: { profile: true } },
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  senderId: { not: user.id },
                  isRead: false,
                },
              },
            },
          },
        },
      });

      logger.info('Direct chat room created', {
        chatRoomId: chatRoom.id,
        parentId: user.id,
        providerId,
      });
    }

    return apiSuccess({
      chatRoom: {
        id: chatRoom.id,
        roomType: 'DIRECT',
        isActive: chatRoom.isActive,
        lastMessageAt: chatRoom.lastMessageAt,
        createdAt: chatRoom.createdAt,
        otherParty: {
          id: provider.id,
          email: provider.email,
          userType: provider.isCaregiver ? 'CAREGIVER' : 'BABYSITTER',
          profile: {
            firstName: provider.profile?.firstName || '',
            lastName: provider.profile?.lastName || '',
            avatar: provider.profile?.avatar,
          },
        },
        lastMessage: chatRoom.messages[0]
          ? {
              id: chatRoom.messages[0].id,
              content: chatRoom.messages[0].content,
              createdAt: chatRoom.messages[0].createdAt,
              senderId: chatRoom.messages[0].senderId,
            }
          : null,
        unreadCount: chatRoom._count.messages,
      },
    });
  } catch (error) {
    logger.error('Error in find-or-create-direct chat room', error);
    return ApiErrors.internal('Failed to access chat room');
  }
}
