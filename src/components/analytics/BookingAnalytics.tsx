"use client";

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  CalendarDaysIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface BookingData {
  period: string;
  bookings: number;
  revenue: number;
  hours: number;
  averageBookingValue: number;
}

interface ServiceData {
  service: string;
  bookings: number;
  revenue: number;
  percentage: number;
  color: string;
}

interface TimeSlotData {
  timeSlot: string;
  bookings: number;
  avgRating: number;
}

interface BookingAnalyticsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
  detailed?: boolean;
}

const BookingAnalytics: React.FC<BookingAnalyticsProps> = ({ period, detailed = false }) => {
  const { theme } = useTheme();
  const [bookingData, setBookingData] = useState<BookingData[]>([]);
  const [serviceData, setServiceData] = useState<ServiceData[]>([]);
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotData[]>([]);
  const [selectedView, setSelectedView] = useState<'trends' | 'services' | 'timing'>('trends');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookingData = async () => {
      setLoading(true);
      try {
        // Mock data based on period
        const mockData = generateMockData(period);
        setBookingData(mockData.trends);
        setServiceData(mockData.services);
        setTimeSlotData(mockData.timing);
      } catch (error) {
        console.error('Error fetching booking data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingData();
  }, [period]);

  const generateMockData = (period: string) => {
    const services: ServiceData[] = [
      { service: 'Evening Care', bookings: 45, revenue: 1125, percentage: 35, color: '#10B981' },
      { service: 'Weekend Sitting', bookings: 32, revenue: 960, percentage: 25, color: '#F59E0B' },
      { service: 'Date Night', bookings: 28, revenue: 700, percentage: 22, color: '#3B82F6' },
      { service: 'After School', bookings: 18, revenue: 450, percentage: 14, color: '#8B5CF6' },
      { service: 'Emergency Care', bookings: 5, revenue: 200, percentage: 4, color: '#EF4444' },
    ];

    const timing: TimeSlotData[] = [
      { timeSlot: '6-9 AM', bookings: 8, avgRating: 4.7 },
      { timeSlot: '9-12 PM', bookings: 15, avgRating: 4.8 },
      { timeSlot: '12-3 PM', bookings: 22, avgRating: 4.9 },
      { timeSlot: '3-6 PM', bookings: 35, avgRating: 4.8 },
      { timeSlot: '6-9 PM', bookings: 42, avgRating: 4.7 },
      { timeSlot: '9-12 AM', bookings: 18, avgRating: 4.6 },
    ];

    let trends: BookingData[];
    
    switch (period) {
      case 'week':
        trends = [
          { period: 'Mon', bookings: 5, revenue: 125, hours: 20, averageBookingValue: 25 },
          { period: 'Tue', bookings: 8, revenue: 200, hours: 32, averageBookingValue: 25 },
          { period: 'Wed', bookings: 6, revenue: 150, hours: 24, averageBookingValue: 25 },
          { period: 'Thu', bookings: 7, revenue: 175, hours: 28, averageBookingValue: 25 },
          { period: 'Fri', bookings: 12, revenue: 300, hours: 48, averageBookingValue: 25 },
          { period: 'Sat', bookings: 15, revenue: 450, hours: 60, averageBookingValue: 30 },
          { period: 'Sun', bookings: 10, revenue: 300, hours: 40, averageBookingValue: 30 },
        ];
        break;
      case 'year':
        trends = [
          { period: 'Jan', bookings: 85, revenue: 2125, hours: 340, averageBookingValue: 25 },
          { period: 'Feb', bookings: 78, revenue: 1950, hours: 312, averageBookingValue: 25 },
          { period: 'Mar', bookings: 95, revenue: 2375, hours: 380, averageBookingValue: 25 },
          { period: 'Apr', bookings: 88, revenue: 2200, hours: 352, averageBookingValue: 25 },
          { period: 'May', bookings: 102, revenue: 2550, hours: 408, averageBookingValue: 25 },
          { period: 'Jun', bookings: 115, revenue: 2875, hours: 460, averageBookingValue: 25 },
          { period: 'Jul', bookings: 128, revenue: 3200, hours: 512, averageBookingValue: 25 },
          { period: 'Aug', bookings: 120, revenue: 3000, hours: 480, averageBookingValue: 25 },
          { period: 'Sep', bookings: 105, revenue: 2625, hours: 420, averageBookingValue: 25 },
          { period: 'Oct', bookings: 92, revenue: 2300, hours: 368, averageBookingValue: 25 },
          { period: 'Nov', bookings: 88, revenue: 2200, hours: 352, averageBookingValue: 25 },
          { period: 'Dec', bookings: 98, revenue: 2450, hours: 392, averageBookingValue: 25 },
        ];
        break;
      default: // month or quarter
        trends = [
          { period: 'Week 1', bookings: 25, revenue: 625, hours: 100, averageBookingValue: 25 },
          { period: 'Week 2', bookings: 28, revenue: 700, hours: 112, averageBookingValue: 25 },
          { period: 'Week 3', bookings: 22, revenue: 550, hours: 88, averageBookingValue: 25 },
          { period: 'Week 4', bookings: 30, revenue: 750, hours: 120, averageBookingValue: 25 },
        ];
    }

    return { trends, services, timing };
  };

  const totalBookings = bookingData.reduce((sum, item) => sum + item.bookings, 0);
  const totalRevenue = bookingData.reduce((sum, item) => sum + item.revenue, 0);
  const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  const chartTheme = {
    background: theme === 'dark' ? '#1F2937' : '#FFFFFF',
    text: theme === 'dark' ? '#F9FAFB' : '#1F2937',
    grid: theme === 'dark' ? '#374151' : '#E5E7EB',
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const csvContent = [
      ['Period', 'Bookings', 'Revenue', 'Hours', 'Avg Booking Value'],
      ...bookingData.map(item => [
        item.period,
        item.bookings.toString(),
        item.revenue.toString(),
        item.hours.toString(),
        item.averageBookingValue.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CalendarDaysIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              Booking Analytics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track booking patterns and service popularity
            </p>
          </div>
          
          {detailed && (
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {[
                  { key: 'trends', label: 'Trends' },
                  { key: 'services', label: 'Services' },
                  { key: 'timing', label: 'Timing' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedView(key as any)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      selectedView === key
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={exportData}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CalendarDaysIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalBookings}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Booking Revenue</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <StarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Booking Value</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  ${averageBookingValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {selectedView === 'trends' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bookingData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis 
                  dataKey="period" 
                  stroke={chartTheme.text}
                  fontSize={12}
                />
                <YAxis 
                  stroke={chartTheme.text}
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartTheme.background,
                    border: `1px solid ${chartTheme.grid}`,
                    borderRadius: '8px',
                    color: chartTheme.text
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="bookings" 
                  stackId="1"
                  stroke="#3B82F6" 
                  fill="#3B82F6"
                  fillOpacity={0.6}
                  name="Bookings"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'services' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ service, percentage }) => 
                    `${service}: ${percentage}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="bookings"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartTheme.background,
                    border: `1px solid ${chartTheme.grid}`,
                    borderRadius: '8px',
                    color: chartTheme.text
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} bookings`,
                    'Count'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'timing' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSlotData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis 
                  dataKey="timeSlot" 
                  stroke={chartTheme.text}
                  fontSize={12}
                />
                <YAxis 
                  stroke={chartTheme.text}
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartTheme.background,
                    border: `1px solid ${chartTheme.grid}`,
                    borderRadius: '8px',
                    color: chartTheme.text
                  }}
                />
                <Legend />
                <Bar dataKey="bookings" fill="#10B981" name="Bookings" />
                <Bar dataKey="avgRating" fill="#F59E0B" name="Avg Rating" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingAnalytics;