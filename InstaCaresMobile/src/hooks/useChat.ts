import { useState, useEffect, useCallback } from 'react';
import { chatAPI, tokenManager } from '../services/api';
import socketService from '../services/socket';

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'parent' | 'caregiver';
  message: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
}

interface ChatRoom {
  id: string;
  participants: {
    id: string;
    name: string;
    role: string;
    profilePicture?: string;
    isOnline?: boolean;
  }[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UseChatState {
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  typingUsers: Set<string>;
}

export const useChat = () => {
  const [state, setState] = useState<UseChatState>({
    rooms: [],
    currentRoom: null,
    messages: [],
    isLoading: false,
    error: null,
    typingUsers: new Set(),
  });

  useEffect(() => {
    // Connect to socket and set up listeners
    connectSocket();
    
    // Only fetch rooms if we have authentication
    checkAuthAndFetchRooms();

    return () => {
      // Cleanup socket listeners
      socketService.off('newMessage', handleNewMessage);
      socketService.off('messageRead', handleMessageRead);
      socketService.off('userTyping', handleUserTyping);
      socketService.off('userStoppedTyping', handleUserStoppedTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthAndFetchRooms = async () => {
    try {
      const token = await tokenManager.getToken();
      const user = await tokenManager.getUser();
      
      console.log('🔐 Auth check - Token:', !!token, 'User:', user);
      
      // Check if we have valid authentication
      const hasValidAuth = token && user && (
        // User might be stored as string ID or object with id property
        typeof user === 'string' || 
        (typeof user === 'object' && (user.id || user.userId))
      );
      
      if (hasValidAuth) {
        fetchRooms();
      } else if (token && !user) {
        console.log('⚠️ Token exists but no user data stored');
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Please log in again to refresh your session',
        }));
      } else {
        console.log('⚠️ No authentication, not fetching chat rooms');
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Please log in to access messages',
        }));
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Authentication error',
      }));
    }
  };

  const connectSocket = async () => {
    try {
      await socketService.connect();
      
      // Set up socket listeners
      socketService.on('newMessage', handleNewMessage);
      socketService.on('messageRead', handleMessageRead);
      socketService.on('userTyping', handleUserTyping);
      socketService.on('userStoppedTyping', handleUserStoppedTyping);
    } catch (error) {
      console.error('Failed to connect socket:', error);
    }
  };

  const fetchRooms = async () => {
    console.log('🔄 Fetching chat rooms...');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await chatAPI.getRooms();
      console.log('📦 Raw Chat API response:', response);
      console.log('📦 Response type:', typeof response, 'Is Array:', Array.isArray(response));
      
      // Handle different possible response structures
      let rooms = [];
      if (Array.isArray(response)) {
        // Direct array response (most likely case based on the API)
        rooms = response;
      } else if (response && response.rooms) {
        rooms = response.rooms;
      } else if (response && response.data) {
        rooms = response.data;
      } else {
        console.warn('⚠️ Unexpected chat API response structure:', response);
        rooms = [];
      }
      
      console.log('💬 Processing chat rooms:', rooms);
      console.log('💬 Number of rooms found:', rooms.length);
      
      console.log('✅ Setting rooms in state:', rooms);
      setState(prev => {
        console.log('📝 Previous state rooms:', prev.rooms);
        console.log('📝 New rooms to set:', rooms);
        return {
          ...prev,
          rooms: rooms,
          isLoading: false,
        };
      });
    } catch (error: any) {
      console.error('❌ Failed to fetch chat rooms:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load chat rooms',
      }));
    }
  };

  const fetchMessages = async (roomId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await chatAPI.getMessages(roomId);
      setState(prev => ({
        ...prev,
        messages: response.messages || [],
        isLoading: false,
      }));
      
      // Join the room for real-time updates
      socketService.joinChatRoom(roomId);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load messages',
      }));
    }
  };

  const sendMessage = async (roomId: string, message: string) => {
    try {
      const response = await chatAPI.sendMessage(roomId, message);
      
      // Optimistically add the message to the state
      const newMessage: Message = {
        id: response.messageId || Date.now().toString(),
        roomId,
        senderId: response.senderId,
        senderName: response.senderName,
        senderRole: response.senderRole,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        delivered: true,
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }));

      // Also send via socket for real-time delivery
      socketService.sendMessage(roomId, message);

      return { success: true, message: newMessage };
    } catch (error: any) {
      console.error('Failed to send message:', error);
      return { success: false, error: error.message };
    }
  };

  const markAsRead = async (roomId: string) => {
    try {
      await chatAPI.markAsRead(roomId);
      
      // Update local state
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.roomId === roomId ? { ...msg, read: true } : msg
        ),
        rooms: prev.rooms.map(room =>
          room.id === roomId ? { ...room, unreadCount: 0 } : room
        ),
      }));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const startTyping = (roomId: string) => {
    socketService.startTyping(roomId);
  };

  const stopTyping = (roomId: string) => {
    socketService.stopTyping(roomId);
  };

  // Socket event handlers
  const handleNewMessage = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, data.message],
      rooms: prev.rooms.map(room => {
        if (room.id === data.roomId) {
          return {
            ...room,
            lastMessage: data.message,
            unreadCount: room.unreadCount + 1,
          };
        }
        return room;
      }),
    }));
  }, []);

  const handleMessageRead = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg =>
        msg.id === data.messageId ? { ...msg, read: true } : msg
      ),
    }));
  }, []);

  const handleUserTyping = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      typingUsers: new Set(prev.typingUsers).add(data.userId),
    }));
  }, []);

  const handleUserStoppedTyping = useCallback((data: any) => {
    setState(prev => {
      const newTypingUsers = new Set(prev.typingUsers);
      newTypingUsers.delete(data.userId);
      return {
        ...prev,
        typingUsers: newTypingUsers,
      };
    });
  }, []);

  const selectRoom = (room: ChatRoom) => {
    setState(prev => ({ ...prev, currentRoom: room }));
    fetchMessages(room.id);
  };

  const leaveRoom = () => {
    if (state.currentRoom) {
      socketService.leaveChatRoom(state.currentRoom.id);
      setState(prev => ({
        ...prev,
        currentRoom: null,
        messages: [],
        typingUsers: new Set(),
      }));
    }
  };

  return {
    ...state,
    fetchRooms,
    fetchMessages,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    selectRoom,
    leaveRoom,
    refreshAfterLogin: checkAuthAndFetchRooms, // Call this after user logs in
  };
};