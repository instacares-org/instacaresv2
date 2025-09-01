import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  Switch,
} from 'react-native';

const { width } = Dimensions.get('window');

// Emoji icons for profile functionality
const UserIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>👤</Text>;
const CogIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⚙️</Text>;
const BellIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🔔</Text>;
const ShieldCheckIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🛡️</Text>;
const CreditCardIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>💳</Text>;
const QuestionMarkCircleIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>❓</Text>;
const ArrowRightIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>→</Text>;
const StarIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⭐</Text>;
const HeartIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>❤️</Text>;
const MapPinIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📍</Text>;
const PhoneIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📞</Text>;
const EnvelopeIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✉️</Text>;
const PencilIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✏️</Text>;
const ShareIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📤</Text>;
const ArrowRightOnRectangleIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🚪</Text>;

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
  blue: '#007AFF',
};

interface ProfileScreenProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const menuItems = [
    {
      section: 'Account',
      items: [
        {
          icon: PencilIcon,
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          onPress: () => console.log('Edit Profile'),
        },
        {
          icon: ShieldCheckIcon,
          title: 'Safety & Verification',
          subtitle: 'ID verification, background checks',
          onPress: () => console.log('Safety'),
        },
        {
          icon: CreditCardIcon,
          title: 'Payment Methods',
          subtitle: 'Manage cards and billing',
          onPress: () => console.log('Payment'),
        },
      ],
    },
    {
      section: 'Preferences',
      items: [
        {
          icon: BellIcon,
          title: 'Notifications',
          subtitle: 'Push notifications, emails',
          hasSwitch: true,
          switchValue: notificationsEnabled,
          onSwitchChange: setNotificationsEnabled,
        },
        {
          icon: MapPinIcon,
          title: 'Location Services',
          subtitle: 'Help caregivers find you',
          hasSwitch: true,
          switchValue: locationEnabled,
          onSwitchChange: setLocationEnabled,
        },
        {
          icon: CogIcon,
          title: 'App Settings',
          subtitle: 'Language, theme, accessibility',
          onPress: () => console.log('Settings'),
        },
      ],
    },
    {
      section: 'Support',
      items: [
        {
          icon: QuestionMarkCircleIcon,
          title: 'Help Center',
          subtitle: 'FAQs, guides, and support',
          onPress: () => console.log('Help'),
        },
        {
          icon: ShareIcon,
          title: 'Share InstaCares',
          subtitle: 'Invite friends and family',
          onPress: () => console.log('Share'),
        },
        {
          icon: ArrowRightOnRectangleIcon,
          title: 'Sign Out',
          subtitle: 'Log out of your account',
          onPress: () => console.log('Sign Out'),
          isDestructive: true,
        },
      ],
    },
  ];

  const renderMenuItem = (item: any, isLast: boolean) => (
    <TouchableOpacity
      key={item.title}
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={item.onPress}
      activeOpacity={0.95}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuItemIcon, item.isDestructive && styles.menuItemIconDestructive]}>
          <item.icon 
            size={20} 
            color={item.isDestructive ? colors.primary : colors.darkGray} 
          />
        </View>
        <View style={styles.menuItemContent}>
          <Text style={[styles.menuItemTitle, item.isDestructive && styles.menuItemTitleDestructive]}>
            {item.title}
          </Text>
          <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      
      <View style={styles.menuItemRight}>
        {item.hasSwitch ? (
          <Switch
            value={item.switchValue}
            onValueChange={item.onSwitchChange}
            trackColor={{ false: colors.borderGray, true: colors.primary }}
            thumbColor={colors.white}
            style={styles.switch}
          />
        ) : (
          <ArrowRightIcon size={16} color={colors.lightGray} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      <Animated.ScrollView 
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/300?img=12' }}
              style={styles.profileAvatar}
            />
            <TouchableOpacity style={styles.editAvatarButton}>
              <PencilIcon size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.profileName}>Alex Johnson</Text>
          <Text style={styles.profileLocation}>New York, NY</Text>
          
          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>4.9</Text>
              <View style={styles.statLabel}>
                <StarIcon size={14} color={colors.warning} />
                <Text style={styles.statText}>Rating</Text>
              </View>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>23</Text>
              <View style={styles.statLabel}>
                <HeartIcon size={14} color={colors.primary} />
                <Text style={styles.statText}>Bookings</Text>
              </View>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <View style={styles.statLabel}>
                <Text style={styles.statText}>Years</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Become a Caregiver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction}>
              <ShareIcon size={18} color={colors.darkGray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Contact */}
        <View style={styles.quickContact}>
          <Text style={styles.sectionTitle}>Quick Contact</Text>
          <View style={styles.contactRow}>
            <View style={styles.contactItem}>
              <PhoneIcon size={16} color={colors.darkGray} />
              <Text style={styles.contactText}>+1 (555) 123-4567</Text>
            </View>
            <View style={styles.contactItem}>
              <EnvelopeIcon size={16} color={colors.darkGray} />
              <Text style={styles.contactText}>alex@email.com</Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={section.section} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.menuContainer}>
              {section.items.map((item, index) => 
                renderMenuItem(item, index === section.items.length - 1)
              )}
            </View>
          </View>
        ))}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>InstaCares v1.0.0</Text>
          <Text style={styles.appBuild}>Build 2024.08.24</Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  scrollView: {
    flex: 1,
  },
  
  // Profile Header
  profileHeader: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 24,
  },
  
  // Profile Stats
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 4,
  },
  statLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: colors.gray,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderGray,
    marginHorizontal: 24,
  },
  
  // Profile Actions
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryAction: {
    backgroundColor: colors.backgroundGray,
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Quick Contact
  quickContact: {
    backgroundColor: colors.white,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  contactRow: {
    marginTop: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 15,
    color: colors.darkGray,
  },
  
  // Sections
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  menuSection: {
    marginTop: 24,
  },
  
  // Menu Items
  menuContainer: {
    backgroundColor: colors.white,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemIconDestructive: {
    backgroundColor: '#FFE5E5',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.black,
    marginBottom: 2,
  },
  menuItemTitleDestructive: {
    color: colors.primary,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: colors.gray,
  },
  menuItemRight: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  switch: {
    transform: [{ scale: 0.8 }],
  },
  
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  appVersion: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 4,
  },
  appBuild: {
    fontSize: 12,
    color: colors.lightGray,
  },
});