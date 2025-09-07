import { Nunito } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { CSRFTokenProvider } from '../components/security/CSRFTokenProvider';
import SessionProvider from '../components/providers/SessionProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import '../lib/imagePreloader'; // Auto-preload critical images
import TokenManager from '../components/providers/TokenManager';

export const metadata = {
  title: 'Instacares',
  description: 'Find childcare services across Canada',
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
        <ErrorBoundary>
          <SessionProvider>
            <ThemeProvider>
              <CSRFTokenProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <TokenManager />
                    {children}
                  </NotificationProvider>
                </AuthProvider>
              </CSRFTokenProvider>
            </ThemeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}