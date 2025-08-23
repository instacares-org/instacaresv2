"use client";

import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ClockIcon,
  StarIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface PerformanceData {
  period: string;
  responseTime: number;
  averageRating: number;
  completionRate: number;
  communicationScore: number;
}

interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

interface ResponseMetric {
  metric: string;
  value: number;
  target: number;
  status: 'excellent' | 'good' | 'needs_improvement';
  color: string;
}

interface PerformanceMetricsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ period }) => {
  const { theme } = useTheme();
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution[]>([]);
  const [responseMetrics, setResponseMetrics] = useState<ResponseMetric[]>([]);
  const [selectedView, setSelectedView] = useState<'trends' | 'ratings' | 'metrics'>('trends');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true);
      try {
        // Mock data based on period
        const mockData = generateMockData(period);
        setPerformanceData(mockData.trends);
        setRatingDistribution(mockData.ratings);
        setResponseMetrics(mockData.metrics);
      } catch (error) {
        console.error('Error fetching performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [period]);

  const generateMockData = (period: string) => {
    const ratings: RatingDistribution[] = [
      { rating: 5, count: 45, percentage: 60 },
      { rating: 4, count: 22, percentage: 29 },
      { rating: 3, count: 6, percentage: 8 },
      { rating: 2, count: 2, percentage: 3 },
      { rating: 1, count: 0, percentage: 0 },
    ];

    const metrics: ResponseMetric[] = [
      { 
        metric: 'Response Time', 
        value: 12, 
        target: 15, 
        status: 'excellent',
        color: '#10B981'
      },
      { 
        metric: 'Booking Acceptance', 
        value: 92, 
        target: 85, 
        status: 'excellent',
        color: '#10B981'
      },
      { 
        metric: 'Completion Rate', 
        value: 98, 
        target: 95, 
        status: 'excellent',
        color: '#10B981'
      },
      { 
        metric: 'Communication Score', 
        value: 88, 
        target: 90, 
        status: 'good',
        color: '#F59E0B'
      },
      { 
        metric: 'Punctuality Score', 
        value: 95, 
        target: 90, 
        status: 'excellent',
        color: '#10B981'
      },
      { 
        metric: 'Follow-up Rate', 
        value: 75, 
        target: 80, 
        status: 'needs_improvement',
        color: '#EF4444'
      },
    ];

    let trends: PerformanceData[];
    
    switch (period) {
      case 'week':
        trends = [
          { period: 'Mon', responseTime: 15, averageRating: 4.7, completionRate: 95, communicationScore: 85 },
          { period: 'Tue', responseTime: 12, averageRating: 4.8, completionRate: 98, communicationScore: 88 },
          { period: 'Wed', responseTime: 10, averageRating: 4.9, completionRate: 100, communicationScore: 90 },
          { period: 'Thu', responseTime: 14, averageRating: 4.8, completionRate: 97, communicationScore: 87 },
          { period: 'Fri', responseTime: 8, averageRating: 4.9, completionRate: 100, communicationScore: 92 },
          { period: 'Sat', responseTime: 11, averageRating: 4.8, completionRate: 98, communicationScore: 89 },
          { period: 'Sun', responseTime: 13, averageRating: 4.7, completionRate: 96, communicationScore: 86 },
        ];
        break;
      case 'year':
        trends = [
          { period: 'Jan', responseTime: 18, averageRating: 4.5, completionRate: 92, communicationScore: 82 },
          { period: 'Feb', responseTime: 16, averageRating: 4.6, completionRate: 94, communicationScore: 84 },
          { period: 'Mar', responseTime: 14, averageRating: 4.7, completionRate: 96, communicationScore: 86 },
          { period: 'Apr', responseTime: 13, averageRating: 4.7, completionRate: 97, communicationScore: 87 },
          { period: 'May', responseTime: 12, averageRating: 4.8, completionRate: 98, communicationScore: 88 },
          { period: 'Jun', responseTime: 10, averageRating: 4.8, completionRate: 99, communicationScore: 90 },
          { period: 'Jul', responseTime: 9, averageRating: 4.9, completionRate: 100, communicationScore: 91 },
          { period: 'Aug', responseTime: 11, averageRating: 4.8, completionRate: 98, communicationScore: 89 },
          { period: 'Sep', responseTime: 12, averageRating: 4.8, completionRate: 97, communicationScore: 88 },
          { period: 'Oct', responseTime: 13, averageRating: 4.7, completionRate: 96, communicationScore: 87 },
          { period: 'Nov', responseTime: 15, averageRating: 4.7, completionRate: 95, communicationScore: 85 },
          { period: 'Dec', responseTime: 14, averageRating: 4.8, completionRate: 96, communicationScore: 86 },
        ];
        break;
      default: // month or quarter
        trends = [
          { period: 'Week 1', responseTime: 15, averageRating: 4.6, completionRate: 94, communicationScore: 84 },
          { period: 'Week 2', responseTime: 13, averageRating: 4.7, completionRate: 96, communicationScore: 86 },
          { period: 'Week 3', responseTime: 11, averageRating: 4.8, completionRate: 98, communicationScore: 88 },
          { period: 'Week 4', responseTime: 12, averageRating: 4.8, completionRate: 97, communicationScore: 87 },
        ];
    }

    return { trends, ratings, metrics };
  };

  const averageResponseTime = performanceData.length > 0 
    ? performanceData.reduce((sum, item) => sum + item.responseTime, 0) / performanceData.length 
    : 0;
  const averageRating = performanceData.length > 0 
    ? performanceData.reduce((sum, item) => sum + item.averageRating, 0) / performanceData.length 
    : 0;
  const averageCompletionRate = performanceData.length > 0 
    ? performanceData.reduce((sum, item) => sum + item.completionRate, 0) / performanceData.length 
    : 0;
  const averageCommunicationScore = performanceData.length > 0 
    ? performanceData.reduce((sum, item) => sum + item.communicationScore, 0) / performanceData.length 
    : 0;

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
      ['Period', 'Response Time', 'Average Rating', 'Completion Rate', 'Communication Score'],
      ...performanceData.map(item => [
        item.period,
        item.responseTime.toString(),
        item.averageRating.toString(),
        item.completionRate.toString(),
        item.communicationScore.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'good':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'needs_improvement':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
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
                { key: 'trends', label: 'Trends' },
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
              <ClockIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {averageResponseTime.toFixed(1)} min
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <StarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Average Rating</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {averageRating.toFixed(1)} ⭐
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
                  {averageCompletionRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Communication</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {averageCommunicationScore.toFixed(1)}%
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
              <LineChart data={performanceData}>
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
                <Line 
                  type="monotone" 
                  dataKey="averageRating" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  name="Rating"
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="completionRate" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Completion %"
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="communicationScore" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Communication %"
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'ratings' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis 
                  dataKey="rating" 
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
                <Bar dataKey="count" fill="#F59E0B" name="Number of Reviews" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'metrics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {responseMetrics.map((metric, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {metric.metric}
                  </h4>
                  {getStatusIcon(metric.status)}
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metric.metric.includes('Time') ? `${metric.value} min` : `${metric.value}%`}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    / {metric.metric.includes('Time') ? `${metric.target} min` : `${metric.target}%`} target
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
                      backgroundColor: metric.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceMetrics;