'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BabysitterCard, { BabysitterCardData } from '@/components/BabysitterCard';
import {
  Search,
  MapPin,
  Star,
  Clock,
  Shield,
  Award,
  Filter,
  ChevronDown,
  Heart,
  Loader2,
  X,
  DollarSign,
  Users,
  CheckCircle
} from 'lucide-react';

interface Babysitter {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  city: string;
  state: string;
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  averageRating: number | null;
  totalBookings: number;
  reviewCount: number;
  acceptsOnsitePayment: boolean;
  stripeOnboarded: boolean;
  trustBadges: string[];
  trustBadgeCount: number;
  availability: Array<{
    recurrenceType?: string;
    day: string | null;
    dayOfWeek?: number | null;
    startTime: string;
    endTime: string;
    specificDate?: string | null;
    dayOfMonth?: number | null;
    repeatInterval?: number;
  }>;
}

interface Filters {
  city: string;
  minRate: number | null;
  maxRate: number | null;
  minRating: number | null;
  dayOfWeek: number | null;
}

const TRUST_BADGE_INFO: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  VERIFIED_ID: { icon: CheckCircle, label: 'Verified ID', color: 'text-green-600' },
  BACKGROUND_CHECKED: { icon: Shield, label: 'Background Check', color: 'text-blue-600' },
  PHONE_VERIFIED: { icon: CheckCircle, label: 'Phone Verified', color: 'text-green-600' },
  CPR_CERTIFIED: { icon: Award, label: 'CPR Certified', color: 'text-red-600' },
  ECE_TRAINED: { icon: Award, label: 'ECE Trained', color: 'text-purple-600' },
  SECURE_PAYMENTS: { icon: DollarSign, label: 'Secure Payments', color: 'text-emerald-600' },
};

const DAY_OPTIONS = [
  { value: null, label: 'Any day' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function FindBabysitterPage() {
  const router = useRouter();
  const [babysitters, setBabysitters] = useState<Babysitter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Filters>({
    city: '',
    minRate: null,
    maxRate: null,
    minRating: null,
    dayOfWeek: null,
  });

  const [sortBy, setSortBy] = useState<'rating' | 'rate' | 'experience'>('rating');

  const fetchBabysitters = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.minRate) params.append('minRate', filters.minRate.toString());
      if (filters.maxRate) params.append('maxRate', filters.maxRate.toString());
      if (filters.minRating) params.append('minRating', filters.minRating.toString());
      if (filters.dayOfWeek !== null) params.append('dayOfWeek', filters.dayOfWeek.toString());
      params.append('sortBy', sortBy);

      const res = await fetch(`/api/babysitters?${params.toString()}`);
      const data = await res.json();
      setBabysitters(data.data?.babysitters || data.babysitters || []);
    } catch (error) {
      console.error('Failed to fetch babysitters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBabysitters();
  }, [sortBy]);

  const handleSearch = () => {
    fetchBabysitters();
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      return newFavorites;
    });
  };

  const clearFilters = () => {
    setFilters({
      city: '',
      minRate: null,
      maxRate: null,
      minRating: null,
      dayOfWeek: null,
    });
  };

  const activeFilterCount = [
    filters.city,
    filters.minRate,
    filters.maxRate,
    filters.minRating,
    filters.dayOfWeek,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Find a Babysitter
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Browse verified babysitters in your area. All babysitters have completed background checks
            and identity verification.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="City or location"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center px-4 py-3 border rounded-lg transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/5'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-[#8B5CF6] text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={handleSearch}
              className="flex items-center justify-center px-6 py-3 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
            >
              <Search className="w-5 h-5 mr-2" />
              Search
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Rate</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minRate || ''}
                    onChange={(e) => setFilters({ ...filters, minRate: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Rate</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="100"
                    value={filters.maxRate || ''}
                    onChange={(e) => setFilters({ ...filters, maxRate: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Rating</label>
                <select
                  value={filters.minRating || ''}
                  onChange={(e) => setFilters({ ...filters, minRating: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Any rating</option>
                  <option value="4.5">4.5+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="3.5">3.5+ stars</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available On</label>
                <select
                  value={filters.dayOfWeek ?? ''}
                  onChange={(e) => setFilters({ ...filters, dayOfWeek: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day.label} value={day.value ?? ''}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sort and Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {isLoading ? 'Searching...' : `${babysitters.length} babysitter${babysitters.length !== 1 ? 's' : ''} found`}
          </p>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#8B5CF6]"
            >
              <option value="rating">Highest Rated</option>
              <option value="rate">Lowest Price</option>
              <option value="experience">Most Experienced</option>
            </select>
          </div>
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
          </div>
        ) : babysitters.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No babysitters found</h3>
            <p className="text-gray-500">Try adjusting your filters or search in a different area.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {babysitters.map((babysitter) => (
              <BabysitterCard
                key={babysitter.id}
                babysitter={{ ...babysitter, type: 'babysitter' as const } as BabysitterCardData}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
