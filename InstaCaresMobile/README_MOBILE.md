# InstaCares Mobile App

React Native mobile application for the InstaCares childcare platform, focusing on real-time chat functionality and seamless user experience.

## 📱 Features

### Core Features
- **Real-time Chat**: Socket.io powered messaging with read receipts
- **Authentication**: Secure login/signup for parents and caregivers
- **Role-based UI**: Different interfaces for parents vs caregivers
- **Profile Management**: User profile editing and management
- **Booking System**: (Coming soon) Mobile booking functionality
- **Search & Filters**: (Coming soon) Find caregivers with advanced filters

### Chat Features
- Real-time messaging with Socket.io
- Message read receipts and delivery status
- Image sharing capabilities
- Conversation management
- Unread message counts
- Connection status indicators
- Message history and search

## 🏗 Architecture

### Folder Structure
```
src/
├── components/
│   ├── chat/              # Chat-specific components
│   ├── common/            # Reusable UI components
│   └── navigation/        # Navigation components
├── screens/
│   ├── auth/              # Login/Signup screens
│   ├── main/              # Main tab screens
│   └── chat/              # Chat screens
├── services/
│   ├── AuthService.ts     # Authentication API calls
│   └── ChatService.ts     # Chat API calls
├── context/
│   ├── AuthContext.tsx    # Authentication state management
│   └── ChatContext.tsx    # Chat state management
├── types/
│   └── index.ts           # TypeScript type definitions
├── utils/                 # Utility functions
└── hooks/                 # Custom React hooks
```

### Key Components

#### Authentication System
- **AuthContext**: Global authentication state management
- **AuthService**: API integration for auth operations
- **Login/Signup Screens**: User authentication interfaces

#### Chat System
- **ChatContext**: Real-time chat state management
- **ChatService**: Chat API and Socket.io integration
- **ChatScreen**: Individual conversation interface
- **MessagesScreen**: Conversation list interface

#### Navigation
- **AppNavigator**: Main navigation structure
- **Tab Navigation**: Bottom tab navigation for main screens
- **Stack Navigation**: Screen navigation within tabs

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. **Install dependencies**
   ```bash
   cd InstaCaresMobile
   npm install
   ```

2. **iOS Setup** (macOS only)
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Android Setup**
   - Ensure Android Studio is installed
   - Set up Android SDK and AVD

### Running the App

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on Android**
   ```bash
   npm run android
   ```

3. **Run on iOS** (macOS only)
   ```bash
   npm run ios
   ```

## 🔧 Configuration

### Environment Setup
Update the API endpoints in the service files:

**AuthService.ts & ChatService.ts**
```typescript
const API_BASE_URL = 'http://your-server-url:3000'; // Update this
```

**ChatContext.tsx**
```typescript
const newSocket = io('ws://your-server-url:3001', { // Update this
  auth: {
    userId: user?.id,
    userType: user?.userType,
  },
});
```

### Server Integration
The mobile app integrates with your existing InstaCares web application:

1. **API Endpoints**: Uses the same REST API endpoints
2. **Socket.io Server**: Requires WebSocket server for real-time chat
3. **Authentication**: Shares authentication system with web app

## 📡 API Integration

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/refresh` - Token refresh
- `PATCH /api/auth/profile` - Update profile

### Chat Endpoints
- `GET /api/chat/conversations` - Get user conversations
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/messages` - Send message
- `PATCH /api/chat/messages/:id/read` - Mark as read

### Socket.io Events
- `connect` / `disconnect` - Connection status
- `new_message` - Receive new message
- `message_read` - Message read confirmation
- `send_message` - Send message
- `mark_read` - Mark message as read

## 🎨 UI/UX Design

### Design System
- **Colors**: Blue primary (#3B82F6), consistent with web app
- **Typography**: System fonts for native feel
- **Spacing**: 8px grid system
- **Icons**: Ionicons for consistency

### User Experience
- **Smooth Navigation**: Tab and stack navigation
- **Real-time Updates**: Instant message delivery
- **Offline Handling**: Graceful connection error handling
- **Loading States**: User feedback during operations

## 🔐 Security Features

### Authentication Security
- Secure token storage with AsyncStorage
- Token refresh mechanism
- Logout on token expiration

### Chat Security
- Message encryption ready (implement end-to-end encryption)
- User blocking/reporting capabilities
- Input validation and sanitization

## 🚧 Development Status

### Completed Features ✅
- Project structure and organization
- Authentication system (login/signup)
- Real-time chat functionality
- Navigation system
- Core UI components
- TypeScript integration
- Context-based state management

### Planned Features 🔄
- Caregiver search and booking
- Push notifications
- Image/file sharing in chat
- Profile photo upload
- Location services integration
- Payment integration
- Review and rating system

## 🧪 Testing

### Running Tests
```bash
npm test
```

### Test Structure
- Unit tests for services and utilities
- Component testing with React Native Testing Library
- Integration tests for chat functionality

## 📦 Building for Production

### Android
```bash
cd android
./gradlew assembleRelease
```

### iOS
1. Open `ios/InstaCaresMobile.xcworkspace` in Xcode
2. Select "Any iOS Device" as target
3. Product → Archive

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow React Native best practices
4. Test on both platforms before submitting
5. Update documentation for new features

## 📝 Notes

- **Separate Codebase**: This is a standalone React Native app, separate from the web application
- **Shared Backend**: Uses the same backend API as the web application
- **Real-time Focus**: Primary emphasis on chat functionality
- **Cross-platform**: Single codebase for both iOS and Android
- **Production Ready**: Structured for scalability and maintenance

## 🆘 Troubleshooting

### Common Issues
1. **Metro bundler issues**: Clear cache with `npm start --reset-cache`
2. **Android build issues**: Clean with `cd android && ./gradlew clean`
3. **iOS build issues**: Clean build folder in Xcode
4. **Socket connection issues**: Check server URL and network connectivity

### Support
For technical support or questions about the mobile app development, refer to:
- React Native documentation
- Socket.io client documentation  
- React Navigation documentation