#!/bin/bash

# InstaCares Staging Deployment Script
# This script deploys the Next.js application to staging environment

set -e

echo "🚀 Starting InstaCares staging deployment..."

# Configuration
APP_NAME="instacares-staging"
STAGING_HOST="${STAGING_HOST:-instacares.xyz}"
STAGING_USER="${STAGING_USER:-staging_user}"
STAGING_PATH="${STAGING_PATH:-/var/www/instacares-staging}"

# Check if staging environment variables are set
if [ -z "$STAGING_HOST" ] || [ -z "$STAGING_USER" ]; then
    echo "❌ Staging environment variables not set!"
    echo "Please set STAGING_HOST and STAGING_USER environment variables"
    exit 1
fi

# Function to run remote commands
run_remote() {
    ssh -o StrictHostKeyChecking=no "${STAGING_USER}@${STAGING_HOST}" "$1"
}

# Build application locally
echo "🏗️ Building application for staging..."
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf instacares-staging.tar.gz \
    .next \
    public \
    prisma \
    package*.json \
    next.config.* \
    ecosystem.config.js \
    server.js \
    src \
    --exclude=node_modules \
    --exclude=.env* \
    --exclude=.git

# Upload to staging server
echo "📤 Uploading to staging server..."
scp instacares-staging.tar.gz "${STAGING_USER}@${STAGING_HOST}:/tmp/"

# Deploy on staging server
echo "🚀 Deploying on staging server..."
run_remote "
    cd ${STAGING_PATH} &&
    pm2 stop ${APP_NAME} || echo 'App was not running' &&
    tar -xzf /tmp/instacares-staging.tar.gz &&
    npm ci --production=false &&
    cp .env.staging .env.local &&
    npx prisma generate &&
    npx prisma db push &&
    pm2 start ecosystem.config.js --name ${APP_NAME} --env staging &&
    pm2 save
"

# Clean up
rm instacares-staging.tar.gz
run_remote "rm /tmp/instacares-staging.tar.gz"

# Health check
echo "🏥 Running health check..."
sleep 10
if curl -f "http://${STAGING_HOST}" > /dev/null 2>&1; then
    echo "✅ Staging deployment successful!"
    echo "🌐 Staging URL: http://${STAGING_HOST}"
else
    echo "❌ Staging deployment may have issues. Check the server logs."
    exit 1
fi

echo "🎉 Staging deployment completed!"