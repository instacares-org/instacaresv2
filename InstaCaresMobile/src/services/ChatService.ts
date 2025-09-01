import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, Conversation, ApiResponse } from '../types';
import { Platform } from 'react-native';

// Use platform-specific URLs
const API_BASE_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? 'http://10.0.2.2:3005' 
    : 'http://localhost:3005'
  : 'https://your-production-domain.com';

class ChatServiceClass {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'An error occurred',
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    return this.makeRequest<Conversation[]>('/api/chat/conversations');
  }

  async getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
    return this.makeRequest<Message[]>(`/api/chat/conversations/${conversationId}/messages`);
  }

  async sendMessage(
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' = 'text'
  ): Promise<Message | null> {
    try {
      const response = await this.makeRequest<Message>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          content,
          messageType,
        }),
      });

      return response.success ? response.data! : null;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  async markAsRead(conversationId: string, messageId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/chat/messages/${messageId}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ conversationId }),
    });
  }

  async markConversationAsRead(conversationId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/chat/conversations/${conversationId}/mark-read`, {
      method: 'PATCH',
    });
  }

  async createConversation(caregiverId: string): Promise<ApiResponse<Conversation>> {
    return this.makeRequest<Conversation>('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ caregiverId }),
    });
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async uploadImage(imageUri: string): Promise<ApiResponse<{ url: string }>> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formData = new FormData();
      
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'chat_image.jpg',
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/chat/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Upload failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Image upload failed:', error);
      return {
        success: false,
        error: 'Failed to upload image',
      };
    }
  }

  async getConversationBetween(caregiverId: string): Promise<ApiResponse<Conversation>> {
    return this.makeRequest<Conversation>(`/api/chat/conversations/between/${caregiverId}`);
  }

  async searchMessages(conversationId: string, query: string): Promise<ApiResponse<Message[]>> {
    return this.makeRequest<Message[]>(
      `/api/chat/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`
    );
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return this.makeRequest<{ count: number }>('/api/chat/unread-count');
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/chat/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async reportMessage(messageId: string, reason: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/api/chat/messages/${messageId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async blockUser(userId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/chat/block-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async unblockUser(userId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/api/chat/unblock-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }
}

export const ChatService = new ChatServiceClass();