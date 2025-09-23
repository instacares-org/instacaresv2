import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Completely ignore ESLint during builds for now
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Disable strict mode that might cause issues
    forceSwcTransforms: true,
  },
  // Try standalone output for better Hostinger compatibility
  output: 'standalone',
  // Reduce hydration warnings from browser extensions
  reactStrictMode: false,
  typescript: {
    // Ignore TypeScript errors during builds for now
    ignoreBuildErrors: true,
  },
  images: {
    // Disable optimization completely for Hostinger compatibility
    unoptimized: true,
    // Removed deprecated domains configuration - using remotePatterns only
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'instacares.net',
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

export default nextConfig;
