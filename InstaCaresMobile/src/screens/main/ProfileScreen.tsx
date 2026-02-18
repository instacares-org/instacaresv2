import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const ProfileOption = ({ icon, title, onPress, showArrow = true }: {
    icon: string;
    title: string;
    onPress: () => void;
    showArrow?: boolean;
  }) => (
    <TouchableOpacity style={styles.profileOption} onPress={onPress}>
      <Icon name={icon} size={24} color="#6B7280" />
      <Text style={styles.profileOptionText}>{title}</Text>
      {showArrow && <Icon name="chevron-forward" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={{
            uri: user?.profileImage || 
            `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=random`
          }}
          style={styles.profileImage}
        />
        <Text style={styles.userName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.userTypeBadge}>
          <Text style={styles.userTypeText}>
            {user?.userType === 'parent' ? 'Parent' : 'Caregiver'}
          </Text>
        </View>
      </View>

      {/* Profile Options */}
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.optionsContainer}>
          <ProfileOption icon="person" title="Edit Profile" onPress={() => {}} />
          <ProfileOption icon="card" title="Payment Methods" onPress={() => {}} />
          <ProfileOption icon="notifications" title="Notifications" onPress={() => {}} />
          <ProfileOption icon="shield-checkmark" title="Privacy & Safety" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.optionsContainer}>
          <ProfileOption icon="help-circle" title="Help Center" onPress={() => {}} />
          <ProfileOption icon="mail" title="Contact Support" onPress={() => {}} />
          <ProfileOption icon="document-text" title="Terms & Privacy" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.optionsContainer}>
          <ProfileOption 
            icon="log-out" 
            title="Logout" 
            onPress={handleLogout}
            showArrow={false}
          />
        </View>
      </View>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>InstaCares Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  userTypeBadge: {
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  userTypeText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  optionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  profileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 16,
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

export default ProfileScreen;