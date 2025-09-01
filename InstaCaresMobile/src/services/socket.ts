import io, { Socket } from 'socket.io-client';
import { tokenManager } from './api';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private isDestroyed: boolean = false;

  async connect(url: string = 'http://10.0.2.2:3007') {
    if (this.isDestroyed) {
      console.warn('SocketService has been destroyed, cannot reconnect');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const token = await tokenManager.getToken();
        
        this.socket = io(url, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket connected');
          this.emit('connected');
          resolve();
        });

        this.socket.on('disconnect', (reason: string) => {
          console.log('❌ Socket disconnected:', reason);
          this.emit('disconnected', { reason });
          
          // Don't try to reconnect if it was a manual disconnect
          if (reason === 'io client disconnect') {
            return;
          }
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('🔴 Socket connection error:', error.message);
          this.emit('error', { 
            type: 'connection_error',
            message: error.message,
            error 
          });
          reject(new Error(`Failed to connect: ${error.message}`));
        });

        this.socket.on('error', (error: any) => {
          console.error('🔴 Socket error:', error);
          this.emit('error', { 
            type: 'socket_error',
            message: error.message || 'Unknown socket error',
            error 
          });
        });

        // Chat events
        this.socket.on('newMessage', (data) => {
          this.emit('newMessage', data);
        });

        this.socket.on('messageRead', (data) => {
          this.emit('messageRead', data);
        });

        this.socket.on('userTyping', (data) => {
          this.emit('userTyping', data);
        });

        this.socket.on('userStoppedTyping', (data) => {
          this.emit('userStoppedTyping', data);
        });

        // Booking events
        this.socket.on('bookingUpdate', (data) => {
          this.emit('bookingUpdate', data);
        });

        this.socket.on('bookingConfirmed', (data) => {
          this.emit('bookingConfirmed', data);
        });

        this.socket.on('bookingCancelled', (data) => {
          this.emit('bookingCancelled', data);
        });

        // Notification events
        this.socket.on('notification', (data) => {
          this.emit('notification', data);
        });

        // Caregiver availability events
        this.socket.on('availabilityUpdate', (data) => {
          this.emit('availabilityUpdate', data);
        });

        // User status events
        this.socket.on('userOnline', (data) => {
          this.emit('userOnline', data);
        });

        this.socket.on('userOffline', (data) => {
          this.emit('userOffline', data);
        });

      } catch (error) {
        console.error('Failed to connect socket:', error);
        reject(error);
      } finally {
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.socket) {
      // Remove all socket.io listeners
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    // Clear our custom listeners
    this.listeners.clear();
    // Reset connection promise
    this.connectionPromise = null;
  }

  // Permanent cleanup - prevents reconnection
  destroy() {
    this.disconnect();
    this.isDestroyed = true;
  }

  // Event emitter methods
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    // Also register with socket.io if it's not an internal event
    if (this.socket && !['connected', 'disconnected', 'error'].includes(event)) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }

      // Also unregister from socket.io
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      // Remove all listeners for this event
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  // Socket.io emit wrapper
  send(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot send:', event, data);
    }
  }

  // Chat methods
  joinChatRoom(roomId: string) {
    this.send('joinRoom', { roomId });
  }

  leaveChatRoom(roomId: string) {
    this.send('leaveRoom', { roomId });
  }

  sendMessage(roomId: string, message: string) {
    this.send('sendMessage', { roomId, message });
  }

  startTyping(roomId: string) {
    this.send('startTyping', { roomId });
  }

  stopTyping(roomId: string) {
    this.send('stopTyping', { roomId });
  }

  markMessageAsRead(messageId: string) {
    this.send('markAsRead', { messageId });
  }

  // Booking methods
  requestBooking(bookingData: any) {
    this.send('requestBooking', bookingData);
  }

  confirmBooking(bookingId: string) {
    this.send('confirmBooking', { bookingId });
  }

  cancelBooking(bookingId: string, reason?: string) {
    this.send('cancelBooking', { bookingId, reason });
  }

  // Availability methods
  updateAvailability(availability: any) {
    this.send('updateAvailability', availability);
  }

  subscribeToCaregiver(caregiverId: string) {
    this.send('subscribeToCaregiver', { caregiverId });
  }

  unsubscribeFromCaregiver(caregiverId: string) {
    this.send('unsubscribeFromCaregiver', { caregiverId });
  }

  // User status
  setUserStatus(status: 'online' | 'away' | 'busy' | 'offline') {
    this.send('setStatus', { status });
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const socketService = new SocketService();

export default socketService;