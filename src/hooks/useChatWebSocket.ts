"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';

interface ChatRoom {
  id: string;
  bookingId: string;
  parentId?: string;
  caregiverId?: string;
  isActive?: boolean;
  lastMessageAt: string | null;
  otherUser?: {
    id: string;
    name: string;
    avatar: string | null;
    userType: string;
  };
  booking?: {
    startTime: string;
    endTime: string;
    status: string;
    address: string;
    parent?: {
      id: string;
      profile?: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
      };
    };
    caregiver?: {
      id: string;
      profile?: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
      };
    };
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    senderName: string;
    isFromMe: boolean;
  } | null;
  unreadCount?: number;
  _count?: {
    messages: number;
  };
}

interface Message {
  id: string;
  content: string;
  messageType: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  isFromMe: boolean;
  sender?: {
    id: string;
    name: string;
    userType: string;
  };
  createdAt: string;
  isRead: boolean;
}

interface UseChatWebSocketProps {
  userId: string;
  userType: 'parent' | 'caregiver' | 'admin';
}

export const useChatWebSocket = ({ userId, userType }: UseChatWebSocketProps) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: string[] }>({});
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    onNewMessage,
    onUserTyping,
    onRoomStatusChanged,
    startTyping,
    stopTyping,
    markMessagesRead
  } = useSocket();

  // Fetch initial chat rooms
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chat/rooms?userId=${userId}&userType=${userType}`);
      if (response.ok) {
        const data = await response.json();
        setRooms(Array.isArray(data) ? data : data.rooms || []);
      } else {
        setError('Failed to fetch chat rooms');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Failed to fetch chat rooms');
    } finally {
      setLoading(false);
    }
  }, [userId, userType]);

  // Fetch messages for a specific room
  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/chat/${roomId}/messages?userId=${userId}&page=1&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => ({
          ...prev,
          [roomId]: data.messages || []
        }));
        
        // Mark messages as read
        if (data.messages && data.messages.length > 0) {
          markMessagesRead(roomId, userId);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [userId, markMessagesRead]);

  // Send a message
  const sendMessage = useCallback(async (roomId: string, content: string, messageType = 'TEXT') => {
    if (!content.trim()) return;

    try {
      // For now, always use HTTP API since WebSocket is mock
      // TODO: Switch to WebSocket when real server is implemented
      const response = await fetch(`/api/chat/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          senderId: userId,
          messageType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Always refresh messages to show the new message
      await fetchMessages(roomId);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  }, [userId, fetchMessages]);

  // Join a chat room
  const joinChatRoom = useCallback((roomId: string) => {
    if (activeRoom && activeRoom !== roomId) {
      leaveRoom(activeRoom);
    }
    
    joinRoom(roomId);
    setActiveRoom(roomId);
    
    // Fetch messages for this room if we don't have them
    if (!messages[roomId]) {
      fetchMessages(roomId);
    }
  }, [activeRoom, joinRoom, leaveRoom, messages, fetchMessages]);

  // Leave a chat room
  const leaveChatRoom = useCallback((roomId: string) => {
    leaveRoom(roomId);
    if (activeRoom === roomId) {
      setActiveRoom(null);
    }
  }, [leaveRoom, activeRoom]);

  // Handle typing indicators
  const handleStartTyping = useCallback((roomId: string, userName: string) => {
    startTyping(roomId, userId, userName);
  }, [startTyping, userId]);

  const handleStopTyping = useCallback((roomId: string) => {
    stopTyping(roomId, userId);
  }, [stopTyping, userId]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Handle new messages
    const unsubscribeNewMessage = onNewMessage((data: { roomId: string; message: Message }) => {
      const { roomId, message } = data;
      setMessages(prev => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), message]
      }));

      // Update room's last message timestamp
      setRooms(prev => prev.map(room => 
        room.id === roomId 
          ? { ...room, lastMessageAt: message.createdAt }
          : room
      ));
    });

    // Handle typing indicators
    const unsubscribeTyping = onUserTyping((data: { userId: string; userName?: string; isTyping: boolean }) => {
      if (!activeRoom) return;
      
      setTypingUsers(prev => {
        const currentUsers = prev[activeRoom] || [];
        if (data.isTyping) {
          return {
            ...prev,
            [activeRoom]: currentUsers.includes(data.userName || data.userId) 
              ? currentUsers 
              : [...currentUsers, data.userName || data.userId]
          };
        } else {
          return {
            ...prev,
            [activeRoom]: currentUsers.filter(user => user !== (data.userName || data.userId))
          };
        }
      });
    });

    // Handle room status changes (admin actions)
    const unsubscribeRoomStatus = onRoomStatusChanged((data: { roomId: string; isActive: boolean; reason: string }) => {
      setRooms(prev => prev.map(room => 
        room.id === data.roomId 
          ? { ...room, isActive: data.isActive }
          : room
      ));
      
      if (!data.isActive) {
        setError(`Chat disabled: ${data.reason}`);
      }
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeTyping();
      unsubscribeRoomStatus();
    };
  }, [isConnected, onNewMessage, onUserTyping, onRoomStatusChanged, activeRoom]);

  // Initial data fetch
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    messages,
    loading,
    error,
    typingUsers,
    activeRoom,
    isConnected,
    fetchRooms,
    fetchMessages,
    sendMessage,
    joinChatRoom,
    leaveChatRoom,
    handleStartTyping,
    handleStopTyping,
    clearError: () => setError(null)
  };
};

export default useChatWebSocket;