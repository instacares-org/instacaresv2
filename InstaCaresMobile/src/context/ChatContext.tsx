import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Message, Conversation } from '../types';
import { useAuth } from './AuthContext';
import { ChatService } from '../services/ChatService';
import { socketService } from '../services/socket';
import { tokenManager } from '../services/api';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: string | null;
  messages: { [conversationId: string]: Message[] };
  unreadCount: number;
  isConnected: boolean;
  sendMessage: (conversationId: string, content: string, messageType?: 'text' | 'image') => Promise<void>;
  markAsRead: (conversationId: string, messageId: string) => Promise<void>;
  setActiveConversation: (conversationId: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  createConversation: (caregiverId: string) => Promise<string | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversationState] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [isConnected, setIsConnected] = useState(false);

  const unreadCount = conversations.reduce((total, conv) => total + conv.unreadCount, 0);

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket();
      fetchConversations();
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, user]);

  const initializeSocket = async () => {
    try {
      await socketService.connect();
      
      // Listen for socket events
      socketService.on('connected', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      socketService.on('disconnected', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socketService.on('newMessage', (data: any) => {
        handleNewMessage(data);
      });

      socketService.on('messageRead', ({ messageId }: any) => {
        if (activeConversation) {
          handleMessageRead(activeConversation, messageId);
        }
      });

      // Check initial connection status
      setIsConnected(socketService.isConnected());
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      setIsConnected(false);
    }
  };


  const handleNewMessage = (message: Message) => {
    setMessages(prev => ({
      ...prev,
      [message.conversationId]: [
        ...(prev[message.conversationId] || []),
        message,
      ],
    }));

    // Update conversation with last message
    setConversations(prev =>
      prev.map(conv =>
        conv.id === message.conversationId
          ? {
              ...conv,
              lastMessage: message,
              unreadCount: message.senderId !== user?.id ? conv.unreadCount + 1 : conv.unreadCount,
            }
          : conv
      )
    );
  };

  const handleMessageRead = (conversationId: string, messageId: string) => {
    setMessages(prev => ({
      ...prev,
      [conversationId]: prev[conversationId]?.map(msg =>
        msg.id === messageId ? { ...msg, isRead: true } : msg
      ) || [],
    }));
  };

  const sendMessage = async (
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' = 'text'
  ): Promise<void> => {
    if (!user) return;

    try {
      // Send via API first
      const message = await ChatService.sendMessage(conversationId, content, messageType);
      if (message) {
        // Then emit via socket for real-time update
        socketService.sendMessage(conversationId, content);
        
        // Add to local state immediately for better UX
        handleNewMessage(message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async (conversationId: string, messageId: string): Promise<void> => {
    try {
      await ChatService.markAsRead(conversationId, messageId);
      socketService.markMessageAsRead(messageId);
      
      // Update local state
      handleMessageRead(conversationId, messageId);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, unreadCount: Math.max(0, conv.unreadCount - 1) }
            : conv
        )
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const setActiveConversation = (conversationId: string | null) => {
    setActiveConversationState(conversationId);
    if (conversationId && !messages[conversationId]) {
      fetchMessages(conversationId);
    }
  };

  const fetchConversations = async (): Promise<void> => {
    try {
      const response = await ChatService.getConversations();
      if (response.success && response.data) {
        setConversations(response.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId: string): Promise<void> => {
    try {
      const response = await ChatService.getMessages(conversationId);
      if (response.success && response.data) {
        setMessages(prev => ({
          ...prev,
          [conversationId]: response.data!,
        }));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const createConversation = async (caregiverId: string): Promise<string | null> => {
    try {
      const response = await ChatService.createConversation(caregiverId);
      if (response.success && response.data) {
        const newConversation = response.data;
        setConversations(prev => [newConversation, ...prev]);
        return newConversation.id;
      }
      return null;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const value: ChatContextType = {
    socket,
    conversations,
    activeConversation,
    messages,
    unreadCount,
    isConnected,
    sendMessage,
    markAsRead,
    setActiveConversation,
    fetchConversations,
    fetchMessages,
    createConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};