// Route configuration to prevent pre-rendering during build
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This prevents Next.js from trying to pre-render this API route during build time
// which was causing the database connection error during GitHub Actions deployment