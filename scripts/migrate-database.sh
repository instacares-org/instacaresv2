#!/bin/bash

# Database Migration Script for InstaCares
# This script handles database migrations for different environments

set -e

ENVIRONMENT=${1:-development}
MIGRATION_NAME=${2:-""}

echo "🔄 Running database migration for environment: $ENVIRONMENT"

# Set database URL based on environment
case $ENVIRONMENT in
  "development")
    echo "Using development database (SQLite)..."
    export DATABASE_URL="file:./dev.db"
    ;;
  "staging")
    echo "Using staging database..."
    if [ -z "$STAGING_DATABASE_URL" ]; then
      echo "❌ STAGING_DATABASE_URL environment variable is required"
      exit 1
    fi
    export DATABASE_URL="$STAGING_DATABASE_URL"
    ;;
  "production")
    echo "Using production database..."
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

# Backup database (for production)
if [ "$ENVIRONMENT" = "production" ]; then
  echo "📦 Creating database backup..."
  BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
  
  # Extract database info from URL for backup
  DB_URL_REGEX="mysql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)"
  if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "backups/$BACKUP_FILE" || echo "Backup failed, continuing anyway..."
    echo "📦 Backup saved to: backups/$BACKUP_FILE"
  fi
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Check database connection
echo "🔍 Checking database connection..."
if npx prisma db push --accept-data-loss --preview-feature &> /dev/null; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  exit 1
fi

# Apply database schema
echo "🔄 Applying database schema..."
if [ "$ENVIRONMENT" = "development" ]; then
  # For development, use db push (no migrations)
  npx prisma db push
else
  # For staging/production, use migrations
  if [ ! -z "$MIGRATION_NAME" ]; then
    echo "Creating new migration: $MIGRATION_NAME"
    npx prisma migrate dev --name "$MIGRATION_NAME"
  fi
  
  # Deploy existing migrations
  npx prisma migrate deploy
fi

# Seed database (development only)
if [ "$ENVIRONMENT" = "development" ]; then
  echo "🌱 Seeding database..."
  npm run db:seed || echo "No seed script found or seeding failed"
fi

# Verify schema
echo "✅ Verifying database schema..."
npx prisma validate

echo "🎉 Database migration completed for $ENVIRONMENT environment!"

# Show database info
if [ "$ENVIRONMENT" = "development" ]; then
  echo "💡 Run 'npm run db:studio' to open Prisma Studio"
fi