"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  ClockIcon,
  StarIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface RatingBreakdown {
  rating: number;
  count: number;
  percentage: number;
}

interface PerformanceMetricsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ period }) => {
  const { theme } = useTheme();
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<RatingBreakdown[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'ratings' | 'metrics'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/caregiver/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json();

        if (result.success && result.data) {
          const { performance } = result.data;
          setAvgRating(performance.avgRating || 0);
          setTotalReviews(performance.totalReviews || 0);
          setCompletionRate(performance.completionRate || 0);
          setAvgResponseTime(performance.avgResponseTime || 0);
          setRatingBreakdown(performance.ratingBreakdown || []);
        }
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Unable to load performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
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
          <StarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{error}</p>
          <p className="text-sm mt-2">Complete bookings and receive reviews to see your metrics</p>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const csvContent = [
      ['Metric', 'Value'],
      ['Average Rating', avgRating.toString()],
      ['Total Reviews', totalReviews.toString()],
      ['Completion Rate', `${completionRate}%`],
      ['Avg Response Time', `${avgResponseTime} min`],
      [''],
      ['Rating Breakdown'],
      ...ratingBreakdown.map(r => [`${r.rating} Stars`, `${r.count} reviews (${r.percentage}%)`])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate star display
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400 text-xl">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-400 text-xl">★</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 dark:text-gray-600 text-xl">★</span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <StarIcon className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
              Performance Metrics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track response times, ratings, and service quality
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'ratings', label: 'Ratings' },
                { key: 'metrics', label: 'Metrics' }
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
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <StarIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Average Rating</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Reviews</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {totalReviews}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Completion Rate</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {completionRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Response</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {avgResponseTime} min
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {totalReviews === 0 && completionRate === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <StarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No performance data available for this period</p>
              <p className="text-sm mt-2">Complete bookings and receive reviews to see your metrics</p>
            </div>
          </div>
        ) : (
          <>
            {selectedView === 'overview' && (
              <div className="h-80 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Overall Rating
                  </h4>
                  <p className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                    {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
                  </p>
                  {avgRating > 0 && renderStars(avgRating)}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-8 w-full max-w-md">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {completionRate}%
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Completion Rate
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {avgResponseTime} min
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Avg Response Time
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedView === 'ratings' && (
              <div className="h-80">
                {ratingBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis type="number" stroke={chartTheme.text} fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="rating"
                        stroke={chartTheme.text}
                        fontSize={12}
                        tickFormatter={(value) => `${value} ★`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.background,
                          border: `1px solid ${chartTheme.grid}`,
                          borderRadius: '8px',
                          color: chartTheme.text
                        }}
                        formatter={((value: any, name: string) => [
                          `${value} reviews`,
                          'Count'
                        ]) as any}
                      />
                      <Bar dataKey="count" fill="#F59E0B" name="Reviews" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No rating data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'metrics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Completion Rate */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Booking Completion Rate
                    </h4>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {completionRate}%
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      / 95% target
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300 bg-green-500"
                      style={{ width: `${Math.min(completionRate, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Response Time */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Average Response Time
                    </h4>
                    <ClockIcon className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {avgResponseTime} min
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      / 15 min target
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        avgResponseTime <= 15 ? 'bg-green-500' : avgResponseTime <= 30 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min((15 / avgResponseTime) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Average Rating */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Average Rating
                    </h4>
                    <StarIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      / 5.0 max
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300 bg-yellow-500"
                      style={{ width: `${(avgRating / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Total Reviews */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Total Reviews
                    </h4>
                    <CheckCircleIcon className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {totalReviews}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      reviews received
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    More reviews help build trust with potential clients
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PerformanceMetrics;
