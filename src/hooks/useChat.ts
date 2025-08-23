import { useState, useEffect, useCallback } from 'react';

export interface ChatRoom {
  id: string;
  bookingId: string;
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
    userType: 'parent' | 'caregiver';
  };
  booking: {
    startTime: Date;
    endTime: Date;
    status: string;
    address: string;
  };
  lastMessage: {
    content: string;
    createdAt: Date;
    senderName: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
  lastMessageAt: Date | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isFromMe: boolean;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface UseChat {
  // Chat rooms
  rooms: ChatRoom[];
  loadingRooms: boolean;
  fetchRooms: () => Promise<void>;
  
  // Messages
  messages: ChatMessage[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  currentPage: number;
  fetchMessages: (roomId: string, page?: number) => Promise<void>;
  loadMoreMessages: (roomId: string) => Promise<void>;
  
  // Actions
  sendMessage: (roomId: string, content: string) => Promise<ChatMessage | null>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markAllMessagesAsRead: (roomId: string) => Promise<void>;
  
  // State
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  sendingMessage: boolean;
}

export const useChat = (userId: string, userType: 'parent' | 'caregiver'): UseChat => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Fetch chat rooms
  const fetchRooms = useCallback(async () => {
    if (!userId || !userType) return;
    
    setLoadingRooms(true);
    try {
      const response = await fetch(
        `/api/chat/rooms?userId=${userId}&userType=${userType}`
      );
      
      if (response.ok) {
        const roomsData = await response.json();
        setRooms(roomsData);
      } else {
        console.error('Failed to fetch chat rooms');
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  }, [userId, userType]);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId: string, page: number = 1) => {
    if (!userId) return;

    setLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/chat/${roomId}/messages?userId=${userId}&page=${page}&limit=50`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setMessages(data.messages || []);
        } else {
          setMessages(prev => [...(data.messages || []), ...(prev || [])]);
        }
        setHasMoreMessages(data.hasMore);
        setCurrentPage(data.currentPage);
      } else {
        console.error('Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [userId]);

  // Load more messages
  const loadMoreMessages = useCallback(async (roomId: string) => {
    if (!hasMoreMessages || loadingMessages) return;
    await fetchMessages(roomId, currentPage + 1);
  }, [fetchMessages, hasMoreMessages, loadingMessages, currentPage]);

  // Send a message
  const sendMessage = useCallback(async (roomId: string, content: string): Promise<ChatMessage | null> => {
    if (!userId || !content.trim()) return null;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/chat/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          senderId: userId,
          messageType: 'TEXT',
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        
        // Add message to current messages
        setMessages(prev => [...(prev || []), newMessage]);
        
        // Update the room's last message
        setRooms(prev => (prev || []).map(room => 
          room.id === roomId 
            ? {
                ...room,
                lastMessage: {
                  content: newMessage.content,
                  createdAt: new Date(newMessage.createdAt),
                  senderName: newMessage.senderName,
                  isFromMe: true,
                },
                lastMessageAt: new Date(newMessage.createdAt),
              }
            : room
        ));
        
        return newMessage;
      } else {
        console.error('Failed to send message');
        return null;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    } finally {
      setSendingMessage(false);
    }
  }, [userId]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update message read status
        setMessages(prev => (prev || []).map(msg => 
          msg.id === messageId 
            ? { ...msg, isRead: true, readAt: new Date(data.readAt) }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [userId]);

  // Mark all messages in room as read
  const markAllMessagesAsRead = useCallback(async (roomId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/chat/messages/bulk/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, roomId }),
      });

      if (response.ok) {
        // Update all unread messages to read
        setMessages(prev => (prev || []).map(msg => 
          !msg.isFromMe && !msg.isRead
            ? { ...msg, isRead: true, readAt: new Date() }
            : msg
        ));
        
        // Update room unread count
        setRooms(prev => (prev || []).map(room => 
          room.id === roomId 
            ? { ...room, unreadCount: 0 }
            : room
        ));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  // Auto-refresh rooms every 30 seconds for new messages
  useEffect(() => {
    if (userId && userType) {
      fetchRooms();
      
      const interval = setInterval(() => {
        fetchRooms();
      }, 30000); // Poll every 30 seconds

      return () => clearInterval(interval);
    }
  }, [userId, userType, fetchRooms]);

  // Auto-refresh messages for active room every 10 seconds
  useEffect(() => {
    if (activeRoomId && userId) {
      const interval = setInterval(() => {
        fetchMessages(activeRoomId, 1);
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
    }
  }, [activeRoomId, userId, fetchMessages]);

  return {
    rooms,
    loadingRooms,
    fetchRooms,
    messages,
    loadingMessages,
    hasMoreMessages,
    currentPage,
    fetchMessages,
    loadMoreMessages,
    sendMessage,
    markMessageAsRead,
    markAllMessagesAsRead,
    activeRoomId,
    setActiveRoomId,
    sendingMessage,
  };
};