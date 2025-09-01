import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useChat();

  const StatCard = ({ icon, title, value, color }: {
    icon: string;
    title: string;
    value: string | number;
    color: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const QuickAction = ({ icon, title, onPress }: {
    icon: string;
    title: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Icon name={icon} size={24} color="#3B82F6" />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome back, {user?.firstName}!
        </Text>
        <Text style={styles.welcomeSubtext}>
          {user?.userType === 'parent' 
            ? 'Find the perfect caregiver for your family'
            : 'Manage your caregiving services'
          }
        </Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {user?.userType === 'parent' ? (
            <>
              <StatCard icon="calendar" title="Active Bookings" value="2" color="#3B82F6" />
              <StatCard icon="chatbubbles" title="Messages" value={unreadCount} color="#10B981" />
              <StatCard icon="heart" title="Favorites" value="5" color="#EF4444" />
              <StatCard icon="star" title="Reviews" value="4.8" color="#F59E0B" />
            </>
          ) : (
            <>
              <StatCard icon="calendar" title="This Week" value="3" color="#3B82F6" />
              <StatCard icon="chatbubbles" title="Messages" value={unreadCount} color="#10B981" />
              <StatCard icon="cash" title="Earnings" value="$240" color="#059669" />
              <StatCard icon="star" title="Rating" value="4.9" color="#F59E0B" />
            </>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {user?.userType === 'parent' ? (
            <>
              <QuickAction icon="search" title="Find Caregivers" onPress={() => {}} />
              <QuickAction icon="add-circle" title="Book Service" onPress={() => {}} />
              <QuickAction icon="people" title="Manage Children" onPress={() => {}} />
              <QuickAction icon="card" title="Payment Methods" onPress={() => {}} />
            </>
          ) : (
            <>
              <QuickAction icon="calendar" title="View Schedule" onPress={() => {}} />
              <QuickAction icon="time" title="Set Availability" onPress={() => {}} />
              <QuickAction icon="person" title="Update Profile" onPress={() => {}} />
              <QuickAction icon="analytics" title="View Earnings" onPress={() => {}} />
            </>
          )}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <Icon name="checkmark-circle" size={20} color="#10B981" />
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Booking completed with Sarah</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
          </View>
          <View style={styles.activityItem}>
            <Icon name="chatbubble" size={20} color="#3B82F6" />
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>New message from parent</Text>
              <Text style={styles.activityTime}>5 hours ago</Text>
            </View>
          </View>
          <View style={styles.activityItem}>
            <Icon name="star" size={20} color="#F59E0B" />
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Received 5-star review</Text>
              <Text style={styles.activityTime}>1 day ago</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  welcomeSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#6B7280',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  quickActionsSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionText: {
    fontSize: 14,
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  recentSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 32,
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default HomeScreen;