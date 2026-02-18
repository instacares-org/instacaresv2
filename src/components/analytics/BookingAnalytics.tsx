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
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface BookingTrend {
  period: string;
  bookings: number;
  completed: number;
  cancelled: number;
}

interface ServiceBreakdown {
  name: string;
  value: number;
  color: string;
}

interface TimingAnalysis {
  timeSlot: string;
  bookings: number;
  popularity: number;
}

interface BookingAnalyticsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
  detailed?: boolean;
}

const BookingAnalytics: React.FC<BookingAnalyticsProps> = ({ period, detailed = false }) => {
  const { theme } = useTheme();
  const [bookingTrend, setBookingTrend] = useState<BookingTrend[]>([]);
  const [servicesBreakdown, setServicesBreakdown] = useState<ServiceBreakdown[]>([]);
  const [timingAnalysis, setTimingAnalysis] = useState<TimingAnalysis[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [completedBookings, setCompletedBookings] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [selectedView, setSelectedView] = useState<'trends' | 'services' | 'timing'>('trends');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookingData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/caregiver/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json();

        if (result.success && result.data) {
          const { bookings } = result.data;
          setBookingTrend(bookings.trend || []);
          setServicesBreakdown(bookings.servicesBreakdown || []);
          setTimingAnalysis(bookings.timingAnalysis || []);
          setTotalBookings(bookings.total || 0);
          setCompletedBookings(bookings.completed || 0);
          setCompletionRate(bookings.completionRate || 0);
        }
      } catch (err) {
        console.error('Error fetching booking data:', err);
        setError('Unable to load booking analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingData();
  }, [period]);

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

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <CalendarDaysIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{error}</p>
          <p className="text-sm mt-2">Complete some bookings to see your analytics</p>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const csvContent = [
      ['Period', 'Bookings', 'Completed', 'Cancelled'],
      ...bookingTrend.map(item => [
        item.period,
        item.bookings.toString(),
        item.completed.toString(),
        item.cancelled.toString()
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
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {completedBookings}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <StarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {completionRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {bookingTrend.length === 0 && servicesBreakdown.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <CalendarDaysIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No booking data available for this period</p>
              <p className="text-sm mt-2">Accept bookings to see your analytics</p>
            </div>
          </div>
        ) : (
          <>
            {selectedView === 'trends' && (
              <div className="h-80">
                {bookingTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bookingTrend}>
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
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No trend data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'services' && (
              <div className="h-80">
                {servicesBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={servicesBreakdown as any[]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) =>
                          `${name}: ${value}`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {servicesBreakdown.map((entry, index) => (
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
                        formatter={(value: any) => [
                          `${value} bookings`,
                          'Count'
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No service data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'timing' && (
              <div className="h-80">
                {timingAnalysis.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timingAnalysis}>
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
                      <Bar dataKey="popularity" fill="#F59E0B" name="Popularity %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No timing data available
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BookingAnalytics;
