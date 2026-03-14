import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.net';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/parent-dashboard',
          '/caregiver-dashboard',
          '/babysitter-dashboard',
          '/complete-profile',
          '/settings',
          '/messages',
          '/bookings',
          '/booking-confirmation',
          '/dashboard',
          '/analytics',
          '/account-status',
          '/login',
          '/signup',
          '/logout',
          '/forgot-password',
          '/caregiver-login',
          '/auth/',
          '/api/',
          '/babysitter/register',
          '/demo-babysitting-card',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
