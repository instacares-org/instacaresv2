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
    unoptimized: false, // Re-enable optimization with simplified config
    formats: ['image/webp'], // Simpler format - just WebP
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60, // Shorter cache for testing
    dangerouslyAllowSVG: true, // Allow SVG processing
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;", // CSP for SVGs
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
