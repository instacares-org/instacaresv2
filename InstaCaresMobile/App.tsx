/**
 * InstaCares Mobile App - Connected to Database
 * Complete integration with desktop app backend
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  SafeAreaView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ChatScreen } from './src/components/ChatScreen';
import { ChatListScreen } from './src/components/ChatListScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { DebugScreen } from './src/components/DebugScreen';
import { useAuth } from './src/hooks/useAuth';
import { useCaregivers, useFeaturedCaregivers } from './src/hooks/useCaregivers';
import { useChat } from './src/hooks/useChat';
import socketService from './src/services/socket';
import { SOCKET_URL } from './src/services/api';

// Temporary emoji icons
const MagnifyingGlassIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🔍</Text>;
const HeartSolid = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>❤️</Text>;
const StarIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⭐</Text>;
const CheckBadgeIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✅</Text>;
const ShieldCheckIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🛡️</Text>;
const HomeIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🏠</Text>;
const ChatBubbleLeftRightIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>💬</Text>;
const CalendarIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📅</Text>;
const UserIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>👤</Text>;
const ArrowRightIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>→</Text>;
const ChevronLeftIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>‹</Text>;
const AdjustmentsHorizontalIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⚙️</Text>;
const EllipsisVerticalIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⋮</Text>;
const MapPinIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📍</Text>;
const HeartOutline = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>♡</Text>;
const UserGroupIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>👥</Text>;
const ClockIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🕐</Text>;
const MoonIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🌙</Text>;
const BoltIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⚡</Text>;
const PaintBrushIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🎨</Text>;
const AcademicCapIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🎓</Text>;

const { width, height } = Dimensions.get('window');

// Colors
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
};

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  // Hooks for API integration
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const { caregivers, isLoading: caregiversLoading, error: caregiversError, refreshCaregivers, updateFilters } = useFeaturedCaregivers();
  const { rooms, messages, sendMessage, selectRoom, fetchRooms } = useChat();

  useEffect(() => {
    // Connect to socket when app starts
    if (isAuthenticated) {
      socketService.connect(SOCKET_URL);
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentScreen, fadeAnim, translateY]);

  // Login Screen Component
  const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
      if (!email || !password) {
        Alert.alert('Error', 'Please enter email and password');
        return;
      }

      setIsLoggingIn(true);
      const result = await login(email, password);
      setIsLoggingIn(false);

      if (result.success) {
        setCurrentScreen('home');
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.authContainer}>
          <View style={styles.authContent}>
            <Image 
              source={require('./android/app/src/main/res/drawable/logo.png')}
              style={styles.authLogo}
              resizeMode="contain"
            />
            <Text style={styles.authTitle}>Welcome Back</Text>
            <Text style={styles.authSubtitle}>Sign in to continue</Text>

            <View style={styles.authForm}>
              <TextInput
                style={styles.authInput}
                placeholder="Email"
                placeholderTextColor={colors.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Password"
                placeholderTextColor={colors.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              
              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleLogin}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.authButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.authFooter}>
                <Text style={styles.authFooterText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => setCurrentScreen('signup')}>
                  <Text style={styles.authLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Welcome Screen with real data
  const WelcomeScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <Animated.View 
          style={[
            styles.welcomeContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            }
          ]}
        >
          {/* Logo Header */}
          <View style={styles.logoHeader}>
            <Image 
              source={require('./android/app/src/main/res/drawable/logo.png')}
              style={styles.logoWelcome}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>InstaCares</Text>
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>
              Find trusted{'\n'}childcare{'\n'}near you
            </Text>
            <Text style={styles.heroSubtitle}>
              {caregivers.length > 0 
                ? `${caregivers.length} verified caregivers available`
                : 'Connect with verified caregivers in your neighborhood'
              }
            </Text>
          </View>

          {/* CTA Buttons */}
          <View style={styles.ctaSection}>
            <TouchableOpacity 
              style={styles.primaryCTA}
              onPress={() => isAuthenticated ? setCurrentScreen('home') : setCurrentScreen('login')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryCTAText}>
                {isAuthenticated ? 'Browse Caregivers' : 'Get Started'}
              </Text>
            </TouchableOpacity>

            {!isAuthenticated && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>

                <TouchableOpacity 
                  style={styles.secondaryCTA}
                  onPress={() => setCurrentScreen('signup')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.secondaryCTAText}>Become a caregiver</Text>
                </TouchableOpacity>

                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => setCurrentScreen('login')}>
                    <Text style={styles.loginLink}>Log in</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );

  // Home Screen with real caregiver data
  const HomeScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderTop}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => setCurrentScreen('welcome')}
          >
            <ChevronLeftIcon size={24} color={colors.black} />
          </TouchableOpacity>
          
          <Image 
            source={require('./android/app/src/main/res/drawable/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          
          <TouchableOpacity 
            style={styles.headerMenuButton}
            onPress={() => setCurrentScreen('debug')}
          >
            <EllipsisVerticalIcon size={24} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.homeSearchBar}>
          <MagnifyingGlassIcon size={20} color={colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search caregivers..."
            placeholderTextColor={colors.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterButton}>
            <AdjustmentsHorizontalIcon size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.homeContent}
      >
        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            <Text style={styles.statsBold}>{caregivers.length} caregivers</Text> available near you
          </Text>
        </View>

        {/* Loading State */}
        {caregiversLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading caregivers...</Text>
          </View>
        )}

        {/* Error State */}
        {caregiversError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{caregiversError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refreshCaregivers}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Caregivers List */}
        {!caregiversLoading && !caregiversError && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured caregivers</Text>
              <TouchableOpacity onPress={refreshCaregivers}>
                <Text style={styles.seeAllLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={caregivers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.caregiverCard} activeOpacity={0.95}>
                  <View style={styles.cardImageContainer}>
                    <Image 
                      source={{ uri: item.profilePicture || 'https://i.pravatar.cc/300' }}
                      style={styles.caregiverImage}
                    />
                    {item.verified && (
                      <View style={styles.verifiedBadge}>
                        <CheckBadgeIcon size={16} color={colors.success} />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.favoriteButton}>
                      <HeartOutline size={20} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.cardContent}>
                    <View style={styles.ratingRow}>
                      <StarIcon size={14} color={colors.black} />
                      <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
                      <Text style={styles.reviews}>({item.reviewCount})</Text>
                    </View>
                    
                    <Text style={styles.caregiverName}>{item.name}</Text>
                    <Text style={styles.caregiverSpecialty}>
                      {item.specialties.join(', ') || 'General Childcare'}
                    </Text>
                    
                    {item.location && (
                      <View style={styles.distanceRow}>
                        <MapPinIcon size={12} color={colors.gray} />
                        <Text style={styles.distance}>{item.location.city}, {item.location.state}</Text>
                      </View>
                    )}
                    
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>${item.hourlyRate}</Text>
                      <Text style={styles.priceUnit}>/hour</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => setCurrentScreen('home')}
        >
          <HomeIcon 
            size={24} 
            color={currentScreen === 'home' ? colors.primary : colors.lightGray} 
          />
          <Text style={[
            styles.tabLabel, 
            currentScreen === 'home' && styles.tabLabelActive
          ]}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => setCurrentScreen('messages')}
        >
          <ChatBubbleLeftRightIcon 
            size={24} 
            color={currentScreen === 'messages' ? colors.primary : colors.lightGray} 
          />
          <Text style={[
            styles.tabLabel, 
            currentScreen === 'messages' && styles.tabLabelActive
          ]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <CalendarIcon size={24} color={colors.lightGray} />
          <Text style={styles.tabLabel}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => setCurrentScreen('profile')}
        >
          <UserIcon 
            size={24} 
            color={currentScreen === 'profile' ? colors.primary : colors.lightGray} 
          />
          <Text style={[
            styles.tabLabel, 
            currentScreen === 'profile' && styles.tabLabelActive
          ]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Chat handlers
  const handleChatSelect = (conversation: any) => {
    setSelectedConversation(conversation);
    setCurrentScreen('chat');
  };

  const handleBackToMessages = () => {
    setSelectedConversation(null);
    setCurrentScreen('messages');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
  };

  // Render current screen
  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingScreenText}>Loading InstaCares...</Text>
      </View>
    );
  }

  switch (currentScreen) {
    case 'login':
      return <LoginScreen />;
    case 'home':
      return <HomeScreen />;
    case 'messages':
      return (
        <ChatListScreen 
          onChatSelect={handleChatSelect}
          onBack={handleBackToHome}
        />
      );
    case 'chat':
      return selectedConversation ? (
        <ChatScreen
          caregiver={{
            id: selectedConversation.id,
            name: selectedConversation.caregiver.name,
            image: selectedConversation.caregiver.image,
            isOnline: selectedConversation.caregiver.isOnline,
            lastSeen: '2 hours ago',
          }}
          onBack={handleBackToMessages}
        />
      ) : (
        <ChatListScreen 
          onChatSelect={handleChatSelect}
          onBack={handleBackToHome}
        />
      );
    case 'profile':
      return (
        <ProfileScreen 
          onBack={handleBackToHome}
        />
      );
    case 'debug':
      return (
        <DebugScreen 
          onBack={handleBackToHome}
        />
      );
    default:
      return <WelcomeScreen />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingScreenText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  
  // Auth Styles
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  authContent: {
    alignItems: 'center',
  },
  authLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 32,
  },
  authForm: {
    width: '100%',
  },
  authInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.black,
    marginBottom: 16,
  },
  authButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  authButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authFooterText: {
    color: colors.gray,
    fontSize: 14,
  },
  authLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Loading & Error States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Rest of your existing styles...
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWelcome: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  heroSection: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.black,
    lineHeight: 52,
    marginBottom: 16,
    letterSpacing: -2,
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.darkGray,
    lineHeight: 26,
  },
  ctaSection: {
    marginTop: 20,
  },
  primaryCTA: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryCTAText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderGray,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.gray,
    fontSize: 14,
  },
  secondaryCTA: {
    borderWidth: 1,
    borderColor: colors.black,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 32,
  },
  secondaryCTAText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: colors.darkGray,
    fontSize: 14,
  },
  loginLink: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  
  // Home Screen
  homeHeader: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  homeHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBackButton: {
    padding: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerMenuButton: {
    padding: 8,
  },
  homeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
  },
  filterButton: {
    padding: 4,
  },
  homeContent: {
    flex: 1,
  },
  statsBar: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.backgroundGray,
  },
  statsText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  statsBold: {
    fontWeight: '600',
    color: colors.black,
  },
  sectionContainer: {
    paddingVertical: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.black,
  },
  seeAllLink: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  
  // Caregiver Cards
  caregiverCard: {
    width: width * 0.7,
    marginLeft: 24,
    marginRight: 8,
  },
  cardImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  caregiverImage: {
    width: '100%',
    height: width * 0.7,
    borderRadius: 12,
    backgroundColor: colors.backgroundGray,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    paddingHorizontal: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
  },
  reviews: {
    fontSize: 14,
    color: colors.gray,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 2,
  },
  caregiverSpecialty: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  distance: {
    fontSize: 14,
    color: colors.gray,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  priceUnit: {
    fontSize: 14,
    color: colors.gray,
    marginLeft: 2,
  },
  
  // Tab Bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default App;