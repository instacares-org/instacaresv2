'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import {
  Star,
  Clock,
  MapPin,
  Shield,
  Award,
  CheckCircle,
  Calendar,
  DollarSign,
  MessageSquare,
  Heart,
  ChevronLeft,
  Loader2,
  Phone,
  Users
} from 'lucide-react';

interface BabysitterProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  city: string;
  state: string;
  bio: string;
  experienceYears: number;
  experienceSummary: string;
  hourlyRate: number;
  isAvailable: boolean;
  maxChildren: number;
  ageGroupsServed: string[] | null;
  totalBookings: number;
  averageRating: number | null;
  acceptsOnsitePayment: boolean;
  stripeOnboarded: boolean;
  trustBadges: Array<{
    type: string;
    label: string;
  }>;
  reviews: Array<{
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

interface Availability {
  id: string;
  recurrenceType: 'ONCE' | 'WEEKLY' | 'MONTHLY';
  day?: string | null;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  specificDate?: string | null;
  dayOfMonth?: number | null;
  repeatInterval?: number;
  anchorDate?: string | null;
}

const TRUST_BADGE_ICONS: Record<string, React.ElementType> = {
  VERIFIED_ID: CheckCircle,
  BACKGROUND_CHECKED: Shield,
  PHONE_VERIFIED: Phone,
  CPR_CERTIFIED: Award,
  ECE_TRAINED: Award,
  SECURE_PAYMENTS: DollarSign,
};

const TRUST_BADGE_COLORS: Record<string, string> = {
  VERIFIED_ID: 'bg-green-100 text-green-700',
  BACKGROUND_CHECKED: 'bg-blue-100 text-blue-700',
  PHONE_VERIFIED: 'bg-green-100 text-green-700',
  CPR_CERTIFIED: 'bg-red-100 text-red-700',
  ECE_TRAINED: 'bg-purple-100 text-purple-700',
  SECURE_PAYMENTS: 'bg-emerald-100 text-emerald-700',
};

export default function BabysitterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [babysitter, setBabysitter] = useState<BabysitterProfile | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, availRes] = await Promise.all([
          fetch(`/api/babysitter/profile?id=${id}`),
          fetch(`/api/babysitter/availability?id=${id}`),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setBabysitter(data);
        }

        if (availRes.ok) {
          const data = await availRes.json();
          setAvailability(data.slots || []);
        }
      } catch (error) {
        console.error('Failed to fetch babysitter profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const handleBookNow = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/babysitter/${id}`);
      return;
    }
    router.push(`/babysitter/${id}/book`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (!babysitter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Babysitter Not Found</h1>
          <p className="text-gray-600 mb-8">This babysitter profile doesn&apos;t exist or is no longer available.</p>
          <button
            onClick={() => router.push('/find-babysitter')}
            className="px-6 py-3 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
          >
            Browse Babysitters
          </button>
        </main>
      </div>
    );
  }

  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklySlots = availability
    .filter(s => s.recurrenceType === 'WEEKLY')
    .sort((a, b) => dayOrder.indexOf(a.day || '') - dayOrder.indexOf(b.day || ''));
  const onceSlots = availability
    .filter(s => s.recurrenceType === 'ONCE')
    .sort((a, b) => (a.specificDate || '').localeCompare(b.specificDate || ''));
  const monthlySlots = availability
    .filter(s => s.recurrenceType === 'MONTHLY')
    .sort((a, b) => (a.dayOfMonth || 0) - (b.dayOfMonth || 0));

  const formatTime12h = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to search
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-xl border p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-start">
            {/* Avatar */}
            <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-8">
              <div className="relative">
                <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center">
                  {babysitter.avatar ? (
                    <img
                      src={babysitter.avatar}
                      alt={babysitter.firstName}
                      className="w-32 h-32 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-semibold text-gray-500">
                      {babysitter.firstName?.charAt(0)}
                    </span>
                  )}
                </div>
                {babysitter.isAvailable && (
                  <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {babysitter.firstName} {babysitter.lastName}
                  </h1>
                  <div className="flex items-center text-gray-500 mt-2">
                    <MapPin className="w-4 h-4 mr-1" />
                    {babysitter.city}, {babysitter.state}
                  </div>
                </div>

                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <Heart
                    className={`w-6 h-6 ${
                      isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
                    }`}
                  />
                </button>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center">
                  {babysitter.averageRating ? (
                    <>
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold text-gray-900 ml-1">
                        {babysitter.averageRating.toFixed(1)}
                      </span>
                      <span className="text-gray-500 ml-1">
                        ({babysitter.reviews.length} reviews)
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">New babysitter</span>
                  )}
                </div>

                <div className="flex items-center text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  {babysitter.experienceYears}+ years experience
                </div>

                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  {babysitter.totalBookings} bookings
                </div>

                <div className="flex items-center text-gray-600">
                  <Users className="w-4 h-4 mr-1" />
                  Up to {babysitter.maxChildren} children
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                {babysitter.trustBadges.map((badge) => {
                  const Icon = TRUST_BADGE_ICONS[badge.type] || CheckCircle;
                  const colorClass = TRUST_BADGE_COLORS[badge.type] || 'bg-gray-100 text-gray-700';
                  return (
                    <span
                      key={badge.type}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Price and Book Button */}
          <div className="mt-6 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-3xl font-bold text-gray-900">${babysitter.hourlyRate}</span>
              <span className="text-gray-500">/hour</span>
              <p className="text-sm text-gray-500 mt-1">
                {babysitter.acceptsOnsitePayment && babysitter.stripeOnboarded
                  ? 'Accepts on-site & platform payments'
                  : babysitter.acceptsOnsitePayment
                  ? 'On-site payment only (cash/e-transfer)'
                  : 'Platform payment only'}
              </p>
            </div>

            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={handleBookNow}
                disabled={!babysitter.isAvailable}
                className="flex-1 sm:flex-none px-8 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {babysitter.isAvailable ? 'Book Now' : 'Currently Unavailable'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - About & Experience */}
          <div className="md:col-span-2 space-y-6">
            {/* About */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
              <p className="text-gray-700 whitespace-pre-line">{babysitter.bio}</p>

              {babysitter.experienceSummary && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-2">Experience</h3>
                  <p className="text-gray-700">{babysitter.experienceSummary}</p>
                </div>
              )}

              {babysitter.ageGroupsServed && babysitter.ageGroupsServed.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-2">Age Groups</h3>
                  <div className="flex flex-wrap gap-2">
                    {babysitter.ageGroupsServed.map((age) => (
                      <span
                        key={age}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {age.charAt(0).toUpperCase() + age.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Reviews ({babysitter.reviews.length})
              </h2>

              {babysitter.reviews.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No reviews yet</p>
              ) : (
                <div className="space-y-6">
                  {babysitter.reviews.map((review, index) => (
                    <div key={index} className={index > 0 ? 'pt-6 border-t' : ''}>
                      <div className="flex items-center mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-500 text-sm ml-2">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Availability */}
          <div className="space-y-6">
            {/* Availability */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Availability</h2>

              {availability.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No availability set</p>
              ) : (
                <div className="space-y-4">
                  {/* Weekly */}
                  {weeklySlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Weekly</h3>
                      <div className="space-y-2">
                        {weeklySlots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{slot.day}</span>
                              {slot.repeatInterval && slot.repeatInterval > 1 && (
                                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
                                  Every {slot.repeatInterval} weeks
                                </span>
                              )}
                            </div>
                            <span className="text-gray-600">
                              {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* One-time */}
                  {onceSlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">One-Time Dates</h3>
                      <div className="space-y-2">
                        {onceSlots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <span className="font-medium text-gray-900">
                              {slot.specificDate ? new Date(slot.specificDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                            </span>
                            <span className="text-gray-600">
                              {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly */}
                  {monthlySlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Monthly</h3>
                      <div className="space-y-2">
                        {monthlySlots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <span className="font-medium text-gray-900">
                              {getOrdinal(slot.dayOfMonth || 1)} of every month
                            </span>
                            <span className="text-gray-600">
                              {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Facts */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Facts</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Response Time</span>
                  <span className="font-medium text-gray-900">Usually within 1 hour</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Cancellation Policy</span>
                  <span className="font-medium text-gray-900">24 hours notice</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Min Booking</span>
                  <span className="font-medium text-gray-900">2 hours</span>
                </div>
              </div>
            </div>

            {/* Contact Info (only visible if logged in) */}
            <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-xl p-6 text-white">
              <h3 className="font-semibold mb-2">Interested?</h3>
              <p className="text-white/80 text-sm mb-4">
                Book a session with {babysitter.firstName} and start the conversation.
              </p>
              <button
                onClick={handleBookNow}
                disabled={!babysitter.isAvailable}
                className="w-full py-3 bg-white text-[#8B5CF6] rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {babysitter.isAvailable ? 'Request Booking' : 'Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
