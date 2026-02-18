"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

interface UnreadCountUpdateData {
  bookingId: string;
  roomId: string;
  unreadCount: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (data: {
    roomId: string;
    content: string;
    senderId: string;
    messageType?: string;
  }) => void;
  onNewMessage: (callback: (data: any) => void) => () => void;
  onUserTyping: (callback: (data: any) => void) => () => void;
  onRoomStatusChanged: (callback: (data: any) => void) => () => void;
  onUnreadCountUpdate: (callback: (data: UnreadCountUpdateData) => void) => () => void;
  startTyping: (roomId: string, userId: string, userName: string) => void;
  stopTyping: (roomId: string, userId: string) => void;
  markMessagesRead: (roomId: string, userId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  joinRoom: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  onNewMessage: () => () => {},
  onUserTyping: () => () => {},
  onRoomStatusChanged: () => () => {},
  onUnreadCountUpdate: () => () => {},
  startTyping: () => {},
  stopTyping: () => {},
  markMessagesRead: () => {},
});

interface SocketProviderProps {
  children: React.ReactNode;
  userId?: string;
  userType?: 'parent' | 'caregiver' | 'admin';
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ 
  children, 
  userId, 
  userType 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Only connect if we have a userId
    if (!userId) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // Create Socket.IO connection
    const socketInstance = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.log('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    // Handle initial list of online users when connecting
    socketInstance.on('online_users_list', ({ users }) => {
      console.log('[Socket] Received online users list:', users);
      setOnlineUsers(new Set(users));
    });

    // Track online users
    socketInstance.on('user_online', ({ userId: onlineUserId }) => {
      console.log('[Socket] User came online:', onlineUserId);
      setOnlineUsers(prev => new Set([...prev, onlineUserId]));
    });

    socketInstance.on('user_offline', ({ userId: offlineUserId }) => {
      console.log('[Socket] User went offline:', offlineUserId);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(offlineUserId);
        return newSet;
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId, userType]);

  const joinRoom = useCallback((roomId: string) => {
    if (socket && userId) {
      socket.emit('join_room', { roomId, userId });
    }
  }, [socket, userId]);

  const leaveRoom = useCallback((roomId: string) => {
    if (socket && userId) {
      socket.emit('leave_room', { roomId, userId });
    }
  }, [socket, userId]);

  const sendMessage = useCallback((data: {
    roomId: string;
    content: string;
    senderId: string;
    messageType?: string;
  }) => {
    if (socket) {
      socket.emit('send_message', {
        ...data,
        messageType: data.messageType || 'text'
      });
    }
  }, [socket]);

  const onNewMessage = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_message', callback);
    return () => {
      socket.off('new_message', callback);
    };
  }, [socket]);

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};
    
    socket.on('user_typing', callback);
    return () => {
      socket.off('user_typing', callback);
    };
  }, [socket]);

  const onRoomStatusChanged = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};

    socket.on('room_status_changed', callback);
    return () => {
      socket.off('room_status_changed', callback);
    };
  }, [socket]);

  const onUnreadCountUpdate = useCallback((callback: (data: UnreadCountUpdateData) => void) => {
    if (!socket) return () => {};

    socket.on('unread_count_update', callback);
    return () => {
      socket.off('unread_count_update', callback);
    };
  }, [socket]);

  const startTyping = useCallback((roomId: string, userId: string, userName: string) => {
    if (socket) {
      socket.emit('typing_start', { roomId, userId, userName });
    }
  }, [socket]);

  const stopTyping = useCallback((roomId: string, userId: string) => {
    if (socket) {
      socket.emit('typing_stop', { roomId, userId });
    }
  }, [socket]);

  const markMessagesRead = useCallback((roomId: string, userId: string) => {
    if (socket) {
      socket.emit('mark_messages_read', { roomId, userId });
    }
  }, [socket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    onNewMessage,
    onUserTyping,
    onRoomStatusChanged,
    onUnreadCountUpdate,
    startTyping,
    stopTyping,
    markMessagesRead,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

/**
 * Safe version of useSocket that returns null values when not within SocketProvider
 * Use this in components that may or may not be within a SocketProvider
 */
export const useSocketSafe = () => {
  const context = useContext(SocketContext);
  // Return a safe fallback if context is the default (no provider)
  // We check if socket is null AND isConnected is false as indicator of default context
  return context;
};

export default SocketContext;