'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CalendarDaysIcon,
  ClockIcon,
  StarIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const EarningsChart = dynamic(() => import('../analytics/EarningsChart'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>,
  ssr: false
});
const BookingAnalytics = dynamic(() => import('../analytics/BookingAnalytics'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading analytics...</span></div>,
  ssr: false
});
const PerformanceMetrics = dynamic(() => import('../analytics/PerformanceMetrics'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading metrics...</span></div>,
  ssr: false
});

interface AnalyticsTabProps {
  completedBookings: number;
  totalEarnings: number;
  averageRating: number | null;
  totalHoursWorked: number;
}

export default function AnalyticsTab({ completedBookings, totalEarnings, averageRating, totalHoursWorked }: AnalyticsTabProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const statCards = [
    { label: 'Total Bookings', value: String(completedBookings), icon: CalendarDaysIcon, color: 'blue' },
    { label: 'Total Earnings', value: `$${totalEarnings.toFixed(0)}`, icon: BanknotesIcon, color: 'green' },
    { label: 'Avg. Rating', value: averageRating?.toFixed(1) || 'N/A', icon: StarIcon, color: 'yellow' },
    { label: 'Hours Worked', value: `${totalHoursWorked.toFixed(0)}h`, icon: ClockIcon, color: 'purple' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics Overview</h3>
          <div className="flex space-x-2">
            {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  period === p
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colors = colorMap[stat.color];
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${colors.split(' ').slice(0, 2).join(' ')}`}>
                  <Icon className={`h-6 w-6 ${colors.split(' ').slice(2).join(' ')}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Earnings Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Earnings Over Time</h3>
        <EarningsChart period={period} />
      </div>

      {/* Booking Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Booking Trends</h3>
          <BookingAnalytics period={period} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
          <PerformanceMetrics period={period} />
        </div>
      </div>
    </div>
  );
}
