"use client";

import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarDaysIcon,
  MapPinIcon,
  StarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as PendingIcon
} from '@heroicons/react/24/outline';

interface AnalyticsData {
  keyMetrics: {
    totalRevenue: { value: number; growth: number; periodValue: number };
    totalBookings: { value: number; growth: number; periodValue: number };
    totalUsers: { value: number; growth: number; periodValue: number };
    averageBookingValue: { value: number; growth: number };
  };
  userAnalytics: {
    totalUsers: number;
    totalParents: number;
    totalCaregivers: number;
    activeUsers: number;
    newUsersThisPeriod: number;
    userEngagementRate: number;
  };
  bookingAnalytics: {
    totalBookings: number;
    bookingsThisPeriod: number;
    completedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    completionRate: number;
    statusDistribution: {
      completed: number;
      pending: number;
      cancelled: number;
    };
  };
  revenueAnalytics: {
    totalRevenue: number;
    revenueThisPeriod: number;
    platformFees: number;
    averageBookingValue: number;
    revenueGrowth: number;
  };
  geographicAnalytics: {
    topCities: Array<{ city: string; userCount: number }>;
  };
  caregiverAnalytics: {
    totalCaregivers: number;
    averageRating: number;
    totalReviews: number;
    verificationStats: { verified: number; unverified: number };
    topEarners: Array<{
      id: string;
      name: string;
      totalEarnings: number;
      totalBookings: number;
      averageRating: number;
    }>;
  };
  chatAnalytics: {
    totalChatRooms: number;
    activeChatRooms: number;
    totalMessages: number;
    chatEngagementRate: number;
  };
  recentActivity: {
    bookings: Array<{
      id: string;
      parentName: string;
      caregiverName: string;
      amount: number;
      status: string;
      createdAt: string;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      reviewerName: string;
      revieweeName: string;
      comment: string;
      createdAt: string;
    }>;
  };
  timeSeriesData: {
    dailyBookings: Array<{ date: string; count: number }>;
    dailyRevenue: Array<{ date: string; revenue: number }>;
    dailyNewUsers: Array<{ date: string; count: number }>;
  };
}

interface AnalyticsDashboardProps {
  adminUserId: string;
}

function AnalyticsDashboard({ adminUserId }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedTab, setSelectedTab] = useState('overview');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics/overview?timeRange=${timeRange}`);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      } else {
        console.error('Failed to fetch analytics data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [adminUserId, timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  const MetricCard = ({ 
    title, 
    value, 
    growth, 
    icon: Icon, 
    format = 'number',
    periodValue 
  }: {
    title: string;
    value: number;
    growth?: number;
    icon: React.ComponentType<any>;
    format?: 'currency' | 'number' | 'percentage';
    periodValue?: number;
  }) => {
    const formatValue = (val: number) => {
      switch (format) {
        case 'currency': return formatCurrency(val);
        case 'percentage': return `${val.toFixed(1)}%`;
        default: return formatNumber(val);
      }
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
            {periodValue !== undefined && (
              <p className="text-sm text-gray-500 mt-1">
                {formatValue(periodValue)} this period
              </p>
            )}
          </div>
          <div className="flex flex-col items-end">
            <Icon className="h-8 w-8 text-gray-400" />
            {growth !== undefined && (
              <div className={`flex items-center mt-2 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growth >= 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                )}
                <span className="text-sm font-medium">{formatPercentage(growth)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={data.keyMetrics.totalRevenue.value}
          growth={data.keyMetrics.totalRevenue.growth}
          periodValue={data.keyMetrics.totalRevenue.periodValue}
          icon={CurrencyDollarIcon}
          format="currency"
        />
        <MetricCard
          title="Total Bookings"
          value={data.keyMetrics.totalBookings.value}
          growth={data.keyMetrics.totalBookings.growth}
          periodValue={data.keyMetrics.totalBookings.periodValue}
          icon={CalendarDaysIcon}
        />
        <MetricCard
          title="Total Users"
          value={data.keyMetrics.totalUsers.value}
          growth={data.keyMetrics.totalUsers.growth}
          periodValue={data.keyMetrics.totalUsers.periodValue}
          icon={UsersIcon}
        />
        <MetricCard
          title="Avg Booking Value"
          value={data.keyMetrics.averageBookingValue.value}
          growth={data.keyMetrics.averageBookingValue.growth}
          icon={ArrowTrendingUpIcon}
          format="currency"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'users', label: 'Users' },
            { key: 'bookings', label: 'Bookings' },
            { key: 'caregivers', label: 'Caregivers' },
            { key: 'geography', label: 'Geography' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Booking Status Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span>Completed</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatNumber(data.bookingAnalytics.completedBookings)}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({((data.bookingAnalytics.completedBookings / data.bookingAnalytics.totalBookings) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <PendingIcon className="h-5 w-5 text-yellow-500 mr-2" />
                  <span>Pending</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatNumber(data.bookingAnalytics.pendingBookings)}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({((data.bookingAnalytics.pendingBookings / data.bookingAnalytics.totalBookings) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                  <span>Cancelled</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatNumber(data.bookingAnalytics.cancelledBookings)}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({((data.bookingAnalytics.cancelledBookings / data.bookingAnalytics.totalBookings) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Analytics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Communication Analytics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Total Chat Rooms</span>
                <span className="font-medium">{formatNumber(data.chatAnalytics.totalChatRooms)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Active Chats</span>
                <span className="font-medium">{formatNumber(data.chatAnalytics.activeChatRooms)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Messages</span>
                <span className="font-medium">{formatNumber(data.chatAnalytics.totalMessages)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Engagement Rate</span>
                <span className="font-medium">{data.chatAnalytics.chatEngagementRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Recent Bookings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participants
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.recentActivity.bookings.slice(0, 5).map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{booking.parentName}</div>
                        <div className="text-sm text-gray-500">with {booking.caregiverName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(booking.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MetricCard
            title="Total Parents"
            value={data.userAnalytics.totalParents}
            icon={UsersIcon}
          />
          <MetricCard
            title="Total Caregivers"
            value={data.userAnalytics.totalCaregivers}
            icon={UsersIcon}
          />
          <MetricCard
            title="User Engagement Rate"
            value={data.userAnalytics.userEngagementRate}
            icon={ArrowTrendingUpIcon}
            format="percentage"
          />
        </div>
      )}

      {selectedTab === 'caregivers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MetricCard
              title="Average Rating"
              value={data.caregiverAnalytics.averageRating}
              icon={StarIcon}
            />
            <MetricCard
              title="Total Reviews"
              value={data.caregiverAnalytics.totalReviews}
              icon={ChatBubbleLeftRightIcon}
            />
            <MetricCard
              title="Verified Caregivers"
              value={data.caregiverAnalytics.verificationStats.verified}
              icon={CheckCircleIcon}
            />
          </div>

          {/* Top Earning Caregivers */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Top Earning Caregivers</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Earnings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bookings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.caregiverAnalytics.topEarners.map((caregiver) => (
                    <tr key={caregiver.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{caregiver.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(caregiver.totalEarnings)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatNumber(caregiver.totalBookings)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                          <span className="text-sm text-gray-900">{caregiver.averageRating.toFixed(1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'geography' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Cities by User Count</h3>
          <div className="space-y-3">
            {data.geographicAnalytics.topCities.map((city, index) => (
              <div key={city.city} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-3">
                    {index + 1}
                  </span>
                  <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="font-medium">{city.city}</span>
                </div>
                <span className="text-sm text-gray-500">{formatNumber(city.userCount)} users</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;