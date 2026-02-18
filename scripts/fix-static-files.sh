#!/bin/bash

# InstaCares Static Files Fix for Standalone Deployment
# This script ensures static files are properly copied to standalone build

set -e

echo "🔧 Fixing static files for standalone deployment..."

# Build the application first
echo "📦 Building application..."
npm run build

# Check if standalone build exists
if [ ! -d ".next/standalone" ]; then
    echo "❌ Standalone build not found. Make sure output: 'standalone' is in next.config.ts"
    exit 1
fi

echo "📂 Copying static files to standalone build..."

# Create public directory in standalone if it doesn't exist
mkdir -p .next/standalone/public

# Copy public assets to standalone
echo "📁 Copying public assets..."
cp -r public/* .next/standalone/public/ 2>/dev/null || echo "⚠️ No public files to copy"

# Copy static assets to standalone
echo "🎨 Copying static assets..."
mkdir -p .next/standalone/public/_next
cp -r .next/static .next/standalone/public/_next/static

# Verify the copy operation
echo "✅ Verifying static files copy..."
if [ -d ".next/standalone/public/_next/static" ]; then
    echo "✅ Static files successfully copied"
    echo "📊 Static files size: $(du -sh .next/standalone/public/_next/static | cut -f1)"
else
    echo "❌ Static files copy failed"
    exit 1
fi

# List what was copied
echo "📋 Contents of standalone public directory:"
ls -la .next/standalone/public/

echo "🎉 Static files fix completed successfully!"
echo "💡 Run this script after every build for production deployment"