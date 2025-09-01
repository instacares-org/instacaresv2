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
  // Reduce hydration warnings from browser extensions
  reactStrictMode: false,
  typescript: {
    // Ignore TypeScript errors during builds for now
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false, // Enable optimization for production
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3008',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3005',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '**',
      },
    ],
    // Define formats - AVIF first for best compression, WebP as fallback
    formats: ['image/avif', 'image/webp'],
    // Optimized device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable lazy loading by default
    loader: 'default',
    // Minimize layout shift
    minimumCacheTTL: 31536000, // 1 year
    // Allow dangerous SVG optimization (if needed)
    dangerouslyAllowSVG: false,
  },
  // Add optimized caching headers
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/caregivers/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
