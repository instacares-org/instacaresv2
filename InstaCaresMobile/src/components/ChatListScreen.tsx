import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useChat } from '../hooks/useChat';

const { width } = Dimensions.get('window');

// Emoji icons
const MagnifyingGlassIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🔍</Text>;
const PencilSquareIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✏️</Text>;

// Airbnb-inspired color palette
const colors = {
  primary: '#FF385C',
  secondary: '#00A699',
  black: '#222222',
  darkGray: '#484848',
  gray: '#767676',
  lightGray: '#B0B0B0',
  borderGray: '#DDDDDD',
  backgroundGray: '#F7F7F7',
  white: '#FFFFFF',
  success: '#008489',
  warning: '#FFB400',
  unreadBadge: '#FF385C',
};

interface Conversation {
  id: string;
  caregiver: {
    name: string;
    image: string;
    isOnline: boolean;
  };
  lastMessage: {
    text: string;
    timestamp: Date;
    sender: 'user' | 'caregiver';
  };
  unreadCount: number;
}

interface ChatListScreenProps {
  onChatSelect: (conversation: Conversation) => void;
  onBack: () => void;
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ onChatSelect, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { rooms, isLoading, error, fetchRooms, refreshAfterLogin } = useChat();
  
  // useChat hook now handles initial fetch automatically

  // Transform chat rooms to match the conversation interface
  const conversations = useMemo(() => rooms?.map(room => {
    console.log('🔄 Transforming chat room:', room);
    
    // Handle the actual API response format from desktop app
    if (room.booking) {
      // This is the actual format from the desktop API
      const caregiverInfo = room.booking.caregiver;
      const caregiverProfile = caregiverInfo?.profile || {};
      
      return {
        id: room.id,
        caregiver: {
          name: `${caregiverProfile.firstName || ''} ${caregiverProfile.lastName || ''}`.trim() || 'Unknown',
          image: caregiverProfile.avatar || 'https://i.pravatar.cc/300',
          isOnline: false, // Will be updated via socket
        },
        lastMessage: room.lastMessage ? {
          text: room.lastMessage.content || 'No message',
          timestamp: new Date(room.lastMessage.createdAt),
          sender: room.lastMessage.sender?.userType === 'PARENT' ? 'user' as const : 'caregiver' as const,
        } : {
          text: 'Start a conversation',
          timestamp: new Date(room.lastMessageAt || Date.now()),
          sender: 'caregiver' as const,
        },
        unreadCount: room.unreadCount || 0,
      };
    }
    
    // Fallback for other formats
    const caregiverParticipant = room.participants?.find(p => p.role !== 'parent');
    
    return {
      id: room.id,
      caregiver: {
        name: caregiverParticipant?.name || caregiverParticipant?.user?.name || 'Unknown',
        image: caregiverParticipant?.profilePicture || caregiverParticipant?.user?.profilePicture || 'https://i.pravatar.cc/300',
        isOnline: caregiverParticipant?.isOnline || false,
      },
      lastMessage: room.lastMessage ? {
        text: room.lastMessage.message || room.lastMessage.text || 'No message',
        timestamp: new Date(room.lastMessage.timestamp || room.lastMessage.createdAt),
        sender: (room.lastMessage.senderRole === 'parent' || room.lastMessage.senderId === room.participants?.find(p => p.role === 'parent')?.id) ? 'user' : 'caregiver',
      } : {
        text: 'Start a conversation',
        timestamp: new Date(room.createdAt || room.updatedAt || Date.now()),
        sender: 'caregiver' as const,
      },
      unreadCount: room.unreadCount || 0,
    };
  }) || [], [rooms]);

  // Mock conversations as fallback if no real data
  const mockConversations = [
    {
      id: '1',
      caregiver: {
        name: 'Sarah Johnson',
        image: 'https://i.pravatar.cc/300?img=1',
        isOnline: true,
      },
      lastMessage: {
        text: "That rate works perfectly for me! I'll be there at 6 PM on Friday.",
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        sender: 'caregiver',
      },
      unreadCount: 2,
    },
    {
      id: '2',
      caregiver: {
        name: 'Emily Chen',
        image: 'https://i.pravatar.cc/300?img=5',
        isOnline: false,
      },
      lastMessage: {
        text: "Thanks for the booking! I'll send you my availability for next week.",
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        sender: 'caregiver',
      },
      unreadCount: 0,
    },
    {
      id: '3',
      caregiver: {
        name: 'Maria Garcia',
        image: 'https://i.pravatar.cc/300?img=9',
        isOnline: true,
      },
      lastMessage: {
        text: "I have experience with special needs children and would love to help!",
        timestamp: new Date(Date.now() - 14400000), // 4 hours ago
        sender: 'caregiver',
      },
      unreadCount: 1,
    },
    {
      id: '4',
      caregiver: {
        name: 'Jessica Wong',
        image: 'https://i.pravatar.cc/300?img=20',
        isOnline: false,
      },
      lastMessage: {
        text: "Perfect! See you tomorrow at 3 PM. I'll bring some activities for the kids.",
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        sender: 'caregiver',
      },
      unreadCount: 0,
    },
    {
      id: '5',
      caregiver: {
        name: 'Amanda Taylor',
        image: 'https://i.pravatar.cc/300?img=25',
        isOnline: false,
      },
      lastMessage: {
        text: "Thank you for choosing me! Your kids were wonderful.",
        timestamp: new Date(Date.now() - 172800000), // 2 days ago
        sender: 'caregiver',
      },
      unreadCount: 0,
    },
  ];

  const formatLastMessageTime = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  console.log('📊 Chat data status:', { 
    roomsCount: rooms?.length || 0,
    conversationsCount: conversations.length,
    isLoading, 
    error,
    rooms: rooms?.slice(0, 2) // Show first 2 rooms for debugging
  });
  
  // Log first conversation to see transformation
  if (conversations.length > 0) {
    console.log('✅ First real conversation:', conversations[0]);
  }

  // Only use mock data if there are NO real conversations and we're not loading
  const shouldUseMockData = conversations.length === 0 && !isLoading && !error;
  
  console.log('🎯 Using mock data?', shouldUseMockData);
  console.log('📦 Rooms from API:', rooms);
  
  const dataToUse = shouldUseMockData ? mockConversations : conversations;
  
  const filteredConversations = useMemo(() => 
    dataToUse.filter(conversation =>
      conversation.caregiver.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [dataToUse, searchQuery]);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => onChatSelect(item)}
      activeOpacity={0.95}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: item.caregiver.image }}
          style={styles.avatar}
        />
        {item.caregiver.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.caregiverName}>{item.caregiver.name}</Text>
          <Text style={styles.timestamp}>
            {formatLastMessageTime(item.lastMessage.timestamp)}
          </Text>
        </View>
        
        <View style={styles.conversationFooter}>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.lastMessageUnread
            ]}
            numberOfLines={2}
          >
            {item.lastMessage.text}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ), [onChatSelect]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.composeButton}>
            <PencilSquareIcon size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MagnifyingGlassIcon size={16} color={colors.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      {/* Conversations List */}
      <View style={styles.conversationsList}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {error.includes('log in') ? (
              <TouchableOpacity style={styles.retryButton} onPress={onBack}>
                <Text style={styles.retryButtonText}>Go to Login</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.retryButton} onPress={refreshAfterLogin}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filteredConversations.length > 0 ? (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No conversations found' : 'No messages yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? 'Try searching for a different name'
                : shouldUseMockData
                  ? 'Using demo conversations since no real conversations exist yet'
                  : error
                    ? 'Unable to load conversations. Check your connection.'
                    : 'Start chatting with caregivers to see your messages here'
              }
            </Text>
            {shouldUseMockData && (
              <Text style={styles.debugText}>
                💡 Connect to your desktop app to see real conversations
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonEmoji}>🔍</Text>
            <Text style={styles.actionButtonText}>Find Caregivers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonEmoji}>📅</Text>
            <Text style={styles.actionButtonText}>Book Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonEmoji}>⭐</Text>
            <Text style={styles.actionButtonText}>Leave Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  
  // Header
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.black,
  },
  composeButton: {
    padding: 8,
  },
  
  // Search
  searchContainer: {
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
  },
  
  // Conversations
  conversationsList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.white,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  timestamp: {
    fontSize: 13,
    color: colors.gray,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.darkGray,
    lineHeight: 18,
    marginRight: 8,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: colors.black,
  },
  unreadBadge: {
    backgroundColor: colors.unreadBadge,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  debugText: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  
  // Quick Actions
  quickActions: {
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  actionButtonEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.darkGray,
  },
  
  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});