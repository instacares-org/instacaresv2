import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { roomId } = await params;

    // Verify user has access to this chat room
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: userId },
          { caregiverId: userId },
        ],
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found or access denied' }, { status: 404 });
    }

    // Get messages with pagination
    const skip = (page - 1) * limit;
    const messages = await db.message.findMany({
      where: {
        chatRoomId: roomId,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: limit,
    });

    // Format messages for frontend
    const formattedMessages = messages.map((message) => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      sender: {
        id: message.senderId,
        userType: message.sender.userType,
        profile: {
          firstName: message.sender.profile?.firstName || '',
          lastName: message.sender.profile?.lastName || '',
          avatar: message.sender.profile?.avatar,
        },
      },
      isFromMe: message.senderId === userId,
      isRead: message.isRead,
      createdAt: message.createdAt,
      readAt: message.readAt,
    }));

    return NextResponse.json({
      messages: formattedMessages,
      hasMore: messages.length === limit,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const body = await request.json();
    const { content, senderId, messageType = 'TEXT' } = body;

    if (!content || !senderId) {
      return NextResponse.json(
        { error: 'Content and sender ID are required' },
        { status: 400 }
      );
    }

    const { roomId } = await params;

    // Verify user has access to this chat room
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: senderId },
          { caregiverId: senderId },
        ],
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found or access denied' }, { status: 404 });
    }

    // Create the message
    const message = await db.message.create({
      data: {
        chatRoomId: roomId,
        senderId,
        content,
        messageType,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update chat room's last message timestamp
    await db.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    // Create notification for the other user
    const otherUserId = chatRoom.parentId === senderId ? chatRoom.caregiverId : chatRoom.parentId;
    const senderName = `${message.sender.profile?.firstName} ${message.sender.profile?.lastName}`;
    
    await db.notification.create({
      data: {
        userId: otherUserId,
        type: 'new_message',
        title: 'New Message',
        message: `${senderName} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        resourceType: 'chat',
        resourceId: roomId,
      },
    });

    // Format response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      sender: {
        id: message.senderId,
        userType: message.sender.userType,
        profile: {
          firstName: message.sender.profile?.firstName || '',
          lastName: message.sender.profile?.lastName || '',
          avatar: message.sender.profile?.avatar,
        },
      },
      isFromMe: true,
      isRead: message.isRead,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };

    return NextResponse.json(formattedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}