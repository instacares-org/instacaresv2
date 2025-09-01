#!/bin/bash

# Database Setup Script for InstaCares
# This script handles database setup for different environments

set -e

ENVIRONMENT=${1:-development}
echo "🗄️ Setting up database for environment: $ENVIRONMENT"

case $ENVIRONMENT in
  "development")
    echo "Setting up development database (SQLite)..."
    export DATABASE_URL="file:./dev.db"
    ;;
  "staging")
    echo "Setting up staging database..."
    if [ -z "$STAGING_DATABASE_URL" ]; then
      echo "❌ STAGING_DATABASE_URL environment variable is required"
      exit 1
    fi
    export DATABASE_URL="$STAGING_DATABASE_URL"
    ;;
  "production")
    echo "Setting up production database..."
    if [ -z "$PROD_DATABASE_URL" ]; then
      echo "❌ PROD_DATABASE_URL environment variable is required"
      exit 1
    fi
    export DATABASE_URL="$PROD_DATABASE_URL"
    ;;
  *)
    echo "❌ Invalid environment. Use: development, staging, or production"
    exit 1
    ;;
esac

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🔄 Pushing database schema..."
npx prisma db push

# Optional: Run seeds for development
if [ "$ENVIRONMENT" = "development" ]; then
  echo "🌱 Seeding development database..."
  npm run db:seed || echo "No seed script found or seeding failed"
fi

echo "✅ Database setup completed for $ENVIRONMENT environment!"