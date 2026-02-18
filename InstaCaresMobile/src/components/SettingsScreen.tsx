import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  Animated,
  Alert,
} from 'react-native';

// Emoji icons
const ChevronLeftIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>‹</Text>;
const BellIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🔔</Text>;
const MoonIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🌙</Text>;
const GlobeAltIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🌍</Text>;
const ShieldCheckIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🛡️</Text>;
const DocumentTextIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📄</Text>;
const TrashIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>🗑️</Text>;
const ArrowRightIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>→</Text>;

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
  destructive: '#FF3B30',
};

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  // Settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const showDeleteAccountAlert = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Account deleted') },
      ]
    );
  };

  const settingSections = [
    {
      title: 'Notifications',
      items: [
        {
          icon: BellIcon,
          title: 'Push Notifications',
          subtitle: 'Receive notifications on this device',
          type: 'switch',
          value: pushNotifications,
          onValueChange: setPushNotifications,
        },
        {
          icon: BellIcon,
          title: 'Email Notifications',
          subtitle: 'Receive updates via email',
          type: 'switch',
          value: emailNotifications,
          onValueChange: setEmailNotifications,
        },
        {
          icon: BellIcon,
          title: 'SMS Notifications',
          subtitle: 'Receive text message alerts',
          type: 'switch',
          value: smsNotifications,
          onValueChange: setSmsNotifications,
        },
        {
          icon: BellIcon,
          title: 'Booking Reminders',
          subtitle: 'Get reminded about upcoming bookings',
          type: 'switch',
          value: bookingReminders,
          onValueChange: setBookingReminders,
        },
        {
          icon: BellIcon,
          title: 'Message Alerts',
          subtitle: 'Notifications for new messages',
          type: 'switch',
          value: messageAlerts,
          onValueChange: setMessageAlerts,
        },
      ],
    },
    {
      title: 'Appearance & Language',
      items: [
        {
          icon: MoonIcon,
          title: 'Dark Mode',
          subtitle: 'Use dark theme throughout the app',
          type: 'switch',
          value: darkMode,
          onValueChange: setDarkMode,
        },
        {
          icon: GlobeAltIcon,
          title: 'Language',
          subtitle: 'English (US)',
          type: 'navigation',
          onPress: () => console.log('Language settings'),
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          icon: ShieldCheckIcon,
          title: 'Location Services',
          subtitle: 'Allow location access for better matching',
          type: 'switch',
          value: locationServices,
          onValueChange: setLocationServices,
        },
        {
          icon: ShieldCheckIcon,
          title: 'Data Sharing',
          subtitle: 'Share usage data to improve service',
          type: 'switch',
          value: dataSharing,
          onValueChange: setDataSharing,
        },
        {
          icon: DocumentTextIcon,
          title: 'Privacy Policy',
          subtitle: 'Read our privacy policy',
          type: 'navigation',
          onPress: () => console.log('Privacy Policy'),
        },
        {
          icon: DocumentTextIcon,
          title: 'Terms of Service',
          subtitle: 'Read our terms of service',
          type: 'navigation',
          onPress: () => console.log('Terms of Service'),
        },
      ],
    },
    {
      title: 'Account Management',
      items: [
        {
          icon: TrashIcon,
          title: 'Delete Account',
          subtitle: 'Permanently delete your account and data',
          type: 'destructive',
          onPress: showDeleteAccountAlert,
        },
      ],
    },
  ];

  const renderSettingItem = (item: any, isLast: boolean) => {
    return (
      <TouchableOpacity
        key={item.title}
        style={[styles.settingItem, isLast && styles.settingItemLast]}
        onPress={item.onPress}
        activeOpacity={item.type === 'switch' ? 1 : 0.95}
      >
        <View style={styles.settingItemLeft}>
          <View style={[
            styles.settingItemIcon,
            item.type === 'destructive' && styles.settingItemIconDestructive
          ]}>
            <item.icon 
              size={20} 
              color={item.type === 'destructive' ? colors.destructive : colors.darkGray} 
            />
          </View>
          <View style={styles.settingItemContent}>
            <Text style={[
              styles.settingItemTitle,
              item.type === 'destructive' && styles.settingItemTitleDestructive
            ]}>
              {item.title}
            </Text>
            <Text style={styles.settingItemSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
        
        <View style={styles.settingItemRight}>
          {item.type === 'switch' ? (
            <Switch
              value={item.value}
              onValueChange={item.onValueChange}
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeftIcon size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <Animated.ScrollView 
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        {settingSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.settingSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.settingContainer}>
              {section.items.map((item, index) => 
                renderSettingItem(item, index === section.items.length - 1)
              )}
            </View>
          </View>
        ))}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoTitle}>About InstaCares</Text>
          <Text style={styles.appInfoText}>
            InstaCares connects families with trusted, verified caregivers in their neighborhood. 
            Our mission is to make childcare accessible, safe, and convenient for everyone.
          </Text>
          <View style={styles.appInfoDetails}>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appBuild}>Build 2024.08.24</Text>
          </View>
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
  },
  headerRight: {
    width: 40, // Balance the header
  },
  
  scrollView: {
    flex: 1,
  },
  
  // Sections
  settingSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  
  // Setting Items
  settingContainer: {
    backgroundColor: colors.white,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingItemIconDestructive: {
    backgroundColor: '#FFE5E5',
  },
  settingItemContent: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.black,
    marginBottom: 2,
  },
  settingItemTitleDestructive: {
    color: colors.destructive,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: colors.gray,
  },
  settingItemRight: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  switch: {
    transform: [{ scale: 0.8 }],
  },
  
  // App Info
  appInfo: {
    backgroundColor: colors.white,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 32,
  },
  appInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
  },
  appInfoText: {
    fontSize: 15,
    color: colors.darkGray,
    lineHeight: 22,
    marginBottom: 20,
  },
  appInfoDetails: {
    alignItems: 'center',
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