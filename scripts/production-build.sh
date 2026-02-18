#!/bin/bash

# InstaCares Production Build Script
# Comprehensive build process for production deployment

set -e

echo "🚀 Starting InstaCares production build process..."

# Clear previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies with exact versions
echo "📦 Installing dependencies..."
npm ci --production=false

# Type checking
echo "🔍 Running TypeScript checks..."
npm run type-check

# Build the application
echo "🏗️ Building Next.js application..."
npm run build:prod

# Analyze bundle size
echo "📊 Analyzing bundle size..."
if [ -f ".next/build-manifest.json" ]; then
    echo "✅ Build manifest created successfully"
else
    echo "❌ Build manifest missing - build may have failed"
    exit 1
fi

# Fix static files for standalone deployment
echo "🔧 Fixing static files for standalone deployment..."
bash scripts/fix-static-files.sh

# Verify standalone build
echo "✅ Verifying standalone build structure..."
if [ -f ".next/standalone/server.js" ]; then
    echo "✅ Standalone server created"
else
    echo "❌ Standalone server missing"
    exit 1
fi

if [ -d ".next/standalone/public/_next/static" ]; then
    echo "✅ Static files properly copied"
    echo "📊 Static assets size: $(du -sh .next/standalone/public/_next/static | cut -f1)"
else
    echo "❌ Static files missing in standalone build"
    exit 1
fi

# Generate deployment summary
echo "📋 Production build summary:"
echo "- Build ID: $(cat .next/BUILD_ID)"
echo "- Static assets size: $(du -sh .next/static | cut -f1)"
echo "- Standalone build size: $(du -sh .next/standalone | cut -f1)"
echo "- Total .next size: $(du -sh .next | cut -f1)"

echo "🎉 Production build completed successfully!"
echo "💡 Deploy with: npm run deploy:production"