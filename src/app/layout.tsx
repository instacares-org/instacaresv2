import { Nunito } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { CSRFTokenProvider } from '../components/security/CSRFTokenProvider';
import SessionProvider from '../components/providers/SessionProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import '../lib/imagePreloader'; // Auto-preload critical images
import TokenManager from '../components/providers/TokenManager';
import CookieConsent from '../components/CookieConsent';
import JsonLd from '../components/JsonLd';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.net';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'InstaCares - Find Trusted Childcare in Canada',
    template: '%s | InstaCares',
  },
  description:
    'Find verified babysitters and caregivers near you. InstaCares connects Canadian families with trusted, background-checked childcare providers.',
  keywords: [
    'babysitter',
    'caregiver',
    'childcare',
    'nanny',
    'Canada',
    'Toronto',
    'babysitting',
    'child care near me',
    'trusted babysitter',
    'verified caregiver',
  ],
  authors: [{ name: 'InstaCares' }],
  creator: 'InstaCares',
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: baseUrl,
    siteName: 'InstaCares',
    title: 'InstaCares - Find Trusted Childcare in Canada',
    description:
      'Find verified babysitters and caregivers near you. InstaCares connects Canadian families with trusted, background-checked childcare providers.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InstaCares - Find Trusted Childcare in Canada',
    description:
      'Find verified babysitters and caregivers near you across Canada.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

const font = Nunito({
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className} bg-white dark:bg-gray-900 transition-colors duration-200`} suppressHydrationWarning>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'InstaCares',
            url: 'https://instacares.net',
            logo: 'https://instacares.net/logo.webp',
            description:
              "Canada's trusted platform connecting families with verified childcare providers.",
            areaServed: {
              '@type': 'Country',
              name: 'Canada',
            },
          }}
        />
        <ErrorBoundary>
          <SessionProvider>
            <ThemeProvider>
              <LanguageProvider>
                <CSRFTokenProvider>
                  <AuthProvider>
                    <NotificationProvider>
                      <TokenManager />
                      <CookieConsent />
                      {children}
                    </NotificationProvider>
                  </AuthProvider>
                </CSRFTokenProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}