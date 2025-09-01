export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImage?: string;
  userType: 'parent' | 'caregiver';
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
}

export interface Caregiver {
  id: string;
  userId: string;
  hourlyRate: number;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  backgroundCheck: boolean;
  user: User;
}

export interface Parent {
  id: string;
  userId: string;
  user: User;
}

export interface Child {
  id: string;
  parentId: string;
  name: string;
  age: number;
  specialNeeds?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: 'text' | 'image' | 'system';
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    userType: 'parent' | 'caregiver';
  };
}

export interface Conversation {
  id: string;
  parentId: string;
  caregiverId: string;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  parent: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      profileImage?: string;
    };
  };
  caregiver: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      profileImage?: string;
    };
  };
}

export interface Booking {
  id: string;
  parentId: string;
  caregiverId: string;
  childId: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  specialInstructions?: string;
  caregiver: Caregiver;
  child: Child;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Signup: { userType?: 'parent' | 'caregiver' };
  Chat: { conversationId: string };
  CaregiverProfile: { caregiverId: string };
  BookingDetails: { bookingId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Messages: undefined;
  Bookings: undefined;
  Profile: undefined;
};

export interface FilterState {
  priceRange: string;
  ageGroups: string[];
  specialServices: string[];
  experience: string;
  availability: string[];
  highlyRated: boolean;
  sortBy: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}