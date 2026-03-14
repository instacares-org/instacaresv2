"use client";

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  XMarkIcon, 
  PaperAirplaneIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { addCSRFHeader } from '@/lib/csrf';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  isRead: boolean;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  otherPartyName: string;
  otherPartyAvatar?: string;
  currentUserId: string;
}

export default function ChatModal({
  isOpen,
  onClose,
  bookingId,
  otherPartyName,
  otherPartyAvatar,
  currentUserId
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && bookingId) {
      initializeChat();
    }
  }, [isOpen, bookingId]);

  const initializeChat = async () => {
    setLoading(true);
    try {
      const roomResponse = await fetch('/api/chat/rooms/find-or-create', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ bookingId })
      });

      if (!roomResponse.ok) {
        throw new Error('Failed to initialize chat');
      }

      const roomData = await roomResponse.json();
      const chatRoom = roomData.chatRoom || roomData.data?.chatRoom;
      if (roomData.success && chatRoom) {
        setChatRoomId(chatRoom.id);
        await loadMessages(chatRoom.id);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      console.log('Loading messages for room:', roomId);
      const response = await fetch(`/api/chat/${roomId}/messages?limit=50`);
      console.log('Messages API response status:', response.status);
      
      console.log("Send message response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        const msgPayload = data.data || data;

        if (msgPayload.messages && Array.isArray(msgPayload.messages)) {
          const formattedMessages = msgPayload.messages.map((m: any) => ({
            id: m.id,
            content: m.content,
            senderId: m.sender?.id || m.senderId,
            createdAt: m.createdAt,
            isRead: m.isRead
          }));
          console.log('Formatted messages:', formattedMessages);
          setMessages(formattedMessages);
        } else {
          console.log('No messages array in response');
        }
      } else {
        const errorText = await response.text();
        console.error('Messages API error:', errorText);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatRoomId || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await fetch(`/api/chat/${chatRoomId}/messages`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          content: messageContent
        })
      });

      console.log('Send message response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Send message response data:', data);
        // The roomId endpoint returns the message directly, not wrapped in success/data
        const msgData = data.id ? data : (data.data || data);
        setMessages(prev => 
          prev.map(m => m.id === optimisticMessage.id ? {
            id: msgData.id,
            content: msgData.content,
            senderId: msgData.sender?.id || currentUserId,
            createdAt: msgData.createdAt,
            isRead: msgData.isRead
          } : m)
        );
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <div className="flex items-center space-x-3">
                    {otherPartyAvatar ? (
                      <Image
                        src={otherPartyAvatar}
                        alt={otherPartyName}
                        width={36}
                        height={36}
                        className="rounded-full border-2 border-white/30"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <UserCircleIcon className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div>
                      <Dialog.Title className="font-semibold text-sm">
                        {otherPartyName}
                      </Dialog.Title>
                      <p className="text-xs text-white/70">Chat</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded-full transition"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
                        <PaperAirplaneIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">Start a conversation</p>
                      <p className="text-xs">Send a message to {otherPartyName.split(' '  )[0]}</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((message, index) => {
                        const isOwn = message.senderId === currentUserId;
                        const showDate = index === 0 || 
                          formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

                        return (
                          <Fragment key={message.id}>
                            {showDate && (
                              <div className="flex justify-center">
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
                                  {formatDate(message.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] ${
                                isOwn 
                                  ? 'bg-green-500 text-white rounded-2xl rounded-br-md' 
                                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-md shadow-sm'
                              } px-3.5 py-2`}>
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                <p className={`text-xs mt-1 ${
                                  isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {formatTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={loading || !chatRoomId}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending || !chatRoomId}
                      className="p-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-full transition"
                    >
                      <PaperAirplaneIcon className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
