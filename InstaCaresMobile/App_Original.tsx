/**
 * InstaCares Mobile App
 * Complete Mobile App with Profile & Settings
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
} from 'react-native';
import { ChatScreen } from './src/components/ChatScreen';
import { ChatListScreen } from './src/components/ChatListScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
// Temporarily using text icons until we fix Heroicons
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
const SparklesIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✨</Text>;
const MoonIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🌙</Text>;
const BoltIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⚡</Text>;
const PaintBrushIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🎨</Text>;
const AcademicCapIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🎓</Text>;
const UserGroupIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>👥</Text>;
const ClockIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🕐</Text>;
const MapPinIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📍</Text>;
const HeartOutline = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>♡</Text>;

const { width, height } = Dimensions.get('window');

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
};

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

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
  }, [currentScreen]);

  // Sample data for caregivers
  const featuredCaregivers = [
    {
      id: '1',
      name: 'Sarah Johnson',
      image: 'https://i.pravatar.cc/300?img=1',
      rating: 4.95,
      reviews: 127,
      hourlyRate: 25,
      distance: '0.8 km away',
      verified: true,
      specialty: 'Infants & Toddlers',
    },
    {
      id: '2',
      name: 'Emily Chen',
      image: 'https://i.pravatar.cc/300?img=5',
      rating: 4.89,
      reviews: 89,
      hourlyRate: 22,
      distance: '1.2 km away',
      verified: true,
      specialty: 'Special Needs Care',
    },
    {
      id: '3',
      name: 'Maria Garcia',
      image: 'https://i.pravatar.cc/300?img=9',
      rating: 4.92,
      reviews: 156,
      hourlyRate: 28,
      distance: '2.1 km away',
      verified: true,
      specialty: 'Educational Activities',
    },
  ];

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
              Connect with verified caregivers in your neighborhood
            </Text>
          </View>

          {/* Search Preview */}
          <TouchableOpacity 
            style={styles.searchBar}
            onPress={() => setCurrentScreen('home')}
            activeOpacity={0.9}
          >
            <View style={styles.searchContent}>
              <MagnifyingGlassIcon size={20} color={colors.gray} />
              <View style={styles.searchTextContainer}>
                <Text style={styles.searchLabel}>Where</Text>
                <Text style={styles.searchPlaceholder}>Your location</Text>
              </View>
            </View>
            <View style={styles.searchButton}>
              <ArrowRightIcon size={20} color={colors.white} />
            </View>
          </TouchableOpacity>

          {/* Categories */}
          <View style={styles.categoriesSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
            >
              {[
                { Icon: UserGroupIcon, label: 'Infants', color: '#FFE5EC' },
                { Icon: UserGroupIcon, label: 'Toddlers', color: '#E5F4FF' },
                { Icon: PaintBrushIcon, label: 'Activities', color: '#FFF4E5' },
                { Icon: MoonIcon, label: 'Overnight', color: '#F0E5FF' },
                { Icon: BoltIcon, label: 'Emergency', color: '#FFE5E5' },
              ].map((category, index) => (
                <TouchableOpacity key={index} style={styles.categoryCard}>
                  <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                    <category.Icon size={28} color={colors.darkGray} />
                  </View>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* CTA Buttons */}
          <View style={styles.ctaSection}>
            <TouchableOpacity 
              style={styles.primaryCTA}
              onPress={() => setCurrentScreen('home')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryCTAText}>Explore caregivers</Text>
            </TouchableOpacity>

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
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => setCurrentScreen('login')}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );

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
          
          <TouchableOpacity style={styles.headerMenuButton}>
            <EllipsisVerticalIcon size={24} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.homeSearchBar}>
          <MagnifyingGlassIcon size={20} color={colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Try 'evening care' or 'certified'"
            placeholderTextColor={colors.gray}
          />
          <TouchableOpacity style={styles.filterButton}>
            <AdjustmentsHorizontalIcon size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterPills}
        >
          {['Available now', 'Top rated', 'Verified', 'Under $25/hr', 'Nearby'].map((filter, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.filterPill, index === 0 && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, index === 0 && styles.filterPillTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.homeContent}
      >
        {/* Quick Stats */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            <Text style={styles.statsBold}>324 caregivers</Text> available near you
          </Text>
        </View>

        {/* Featured Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured caregivers</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllLink}>See all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={featuredCaregivers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.caregiverCard} activeOpacity={0.95}>
                <View style={styles.cardImageContainer}>
                  <Image 
                    source={{ uri: item.image }}
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
                    <Text style={styles.rating}>{item.rating}</Text>
                    <Text style={styles.reviews}>({item.reviews})</Text>
                  </View>
                  
                  <Text style={styles.caregiverName}>{item.name}</Text>
                  <Text style={styles.caregiverSpecialty}>{item.specialty}</Text>
                  
                  <View style={styles.distanceRow}>
                    <MapPinIcon size={12} color={colors.gray} />
                    <Text style={styles.distance}>{item.distance}</Text>
                  </View>
                  
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>${item.hourlyRate}</Text>
                    <Text style={styles.priceUnit}>/hour</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Categories Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Browse by category</Text>
          <View style={styles.categoryGrid}>
            {[
              { Icon: UserGroupIcon, label: 'Newborn care', count: '43' },
              { Icon: ClockIcon, label: 'After school', count: '89' },
              { Icon: MoonIcon, label: 'Night care', count: '27' },
              { Icon: AcademicCapIcon, label: 'Tutoring', count: '56' },
            ].map((item, index) => (
              <TouchableOpacity key={index} style={styles.categoryGridCard}>
                <item.Icon size={32} color={colors.primary} />
                <Text style={styles.categoryGridLabel}>{item.label}</Text>
                <Text style={styles.categoryGridCount}>{item.count} available</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trust Section */}
        <View style={styles.trustSection}>
          <ShieldCheckIcon size={32} color={colors.success} />
          <Text style={styles.trustTitle}>Your safety is our priority</Text>
          <Text style={styles.trustText}>
            All caregivers are background checked and verified
          </Text>
        </View>
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
  switch (currentScreen) {
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
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  
  // Logo and Brand
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
  
  // Hero Section
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
  
  // Search Bar
  searchBar: {
    backgroundColor: colors.white,
    borderRadius: 32,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.borderGray,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 16,
    gap: 12,
  },
  searchTextContainer: {
    flex: 1,
  },
  searchLabel: {
    fontSize: 12,
    color: colors.black,
    fontWeight: '600',
    marginBottom: 2,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: colors.gray,
  },
  searchButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Categories
  categoriesSection: {
    marginBottom: 32,
  },
  categoriesScroll: {
    paddingRight: 24,
  },
  categoryCard: {
    marginRight: 16,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 13,
    color: colors.darkGray,
    fontWeight: '500',
  },
  
  // CTA Section
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
  
  // Login Link
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
  
  // Home Search Bar
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
  
  // Filter Pills
  filterPills: {
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGray,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterPillText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  
  // Home Content
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
  
  // Sections
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
    paddingHorizontal: 24,
    marginBottom: 16,
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
  
  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
  },
  categoryGridCard: {
    width: '48%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    marginRight: '2%',
    marginBottom: 12,
    alignItems: 'center',
  },
  categoryGridLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
    marginTop: 12,
  },
  categoryGridCount: {
    fontSize: 12,
    color: colors.gray,
  },
  
  // Trust Section
  trustSection: {
    backgroundColor: colors.backgroundGray,
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 100,
  },
  trustTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
    marginTop: 12,
    marginBottom: 8,
  },
  trustText: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
    lineHeight: 20,
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