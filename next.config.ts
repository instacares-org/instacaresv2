import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Disable strict mode that might cause issues
    forceSwcTransforms: true,
  },
  // Use standard output for better static file compatibility
  // output: 'standalone',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Removed deprecated domains configuration - using remotePatterns only
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'instacares.xyz',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'instacares.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'instacares.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'instacares.ca',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3005',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600, // 1 hour cache
    dangerouslyAllowSVG: true,
  },
  // Disable custom headers for Hostinger compatibility
  // async headers() {
  //   return [];
  // },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
