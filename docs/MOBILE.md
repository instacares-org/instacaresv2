# InstaCares Mobile App Documentation

## Overview
React Native application for iOS and Android platforms, providing mobile access to the InstaCares platform.

## Setup Requirements

### Prerequisites
- Node.js 20+
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development on Mac)
- JDK 11 or higher

### Environment Setup

#### Android (Windows/Mac/Linux)
```bash
# Set environment variables
ANDROID_HOME=/path/to/Android/Sdk
PATH=$PATH:$ANDROID_HOME/emulator
PATH=$PATH:$ANDROID_HOME/platform-tools
```

#### iOS (Mac only)
```bash
# Install CocoaPods
sudo gem install cocoapods
cd ios && pod install
```

## Installation

```bash
# Navigate to mobile directory
cd InstaCaresMobile

# Install dependencies
npm install

# iOS only - install pods
cd ios && pod install && cd ..
```

## Running the App

### Start Metro Bundler
```bash
npx react-native start
```

### Run on Android
```bash
# Start emulator first, then:
npx react-native run-android
```

### Run on iOS
```bash
npx react-native run-ios
```

## Project Structure

```
InstaCaresMobile/
├── android/           # Android-specific code
├── ios/              # iOS-specific code
├── src/
│   ├── components/   # Reusable components
│   ├── screens/      # Screen components
│   ├── services/     # API and services
│   ├── context/      # React Context providers
│   ├── hooks/        # Custom hooks
│   └── utils/        # Utility functions
├── App.tsx           # Main app component
└── package.json      # Dependencies
```

## Key Features

- **Authentication**: JWT-based login/signup
- **Chat System**: Real-time messaging with Socket.io
- **Caregiver Search**: Location-based search
- **Booking System**: Schedule and manage bookings
- **Push Notifications**: Firebase messaging
- **Payment Integration**: Stripe payments

## API Configuration

Update `src/services/api.ts`:
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3005/api'
  : 'https://yourdomain.com/api';
```

## Common Issues & Solutions

### Android Build Issues
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### iOS Build Issues
```bash
# Clean build folder
cd ios
xcodebuild clean
pod install
cd ..
npx react-native run-ios
```

### Metro Bundler Issues
```bash
# Clear cache
npx react-native start --reset-cache
```

## Testing

### Run Tests
```bash
npm test
```

### Debug Mode
- **Android**: Shake device or Ctrl+M
- **iOS**: Shake device or Cmd+D

## Building for Production

### Android APK
```bash
cd android
./gradlew assembleRelease
# APK location: android/app/build/outputs/apk/release/
```

### iOS Build
1. Open `ios/InstaCaresMobile.xcworkspace` in Xcode
2. Select Generic iOS Device
3. Product → Archive
4. Upload to App Store Connect

## Performance Optimization

- Enable Hermes for Android (already configured)
- Use React.memo for component optimization
- Implement lazy loading for screens
- Optimize images with proper sizing

## Deployment Checklist

- [ ] Update API endpoints for production
- [ ] Configure push notification certificates
- [ ] Set up code signing (iOS)
- [ ] Generate release keystore (Android)
- [ ] Test on real devices
- [ ] Submit to app stores

## Maintenance

### Update Dependencies
```bash
npm update
cd ios && pod update
```

### Check for Security Issues
```bash
npm audit
npm audit fix
```

---

Last updated: January 2025