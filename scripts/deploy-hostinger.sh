#!/bin/bash

# InstaCares Hostinger Deployment Script
# This script deploys the Next.js application to Hostinger hosting

set -e  # Exit on any error

# Configuration
APP_NAME="instacares"
REMOTE_PATH="${HOSTINGER_PATH:-/public_html}"
BACKUP_DIR="${REMOTE_PATH}/backups"
CURRENT_DATE=$(date +"%Y%m%d_%H%M%S")

echo "🚀 Starting InstaCares deployment to Hostinger..."
echo "Target: ${HOSTINGER_USER}@${HOSTINGER_HOST}:${REMOTE_PATH}"

# Function to run remote commands
run_remote() {
    ssh -o StrictHostKeyChecking=no "${HOSTINGER_USER}@${HOSTINGER_HOST}" "$1"
}

# Function to copy files to remote server
copy_files() {
    rsync -avz --delete \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env* \
        --exclude=prisma/dev.db \
        --exclude=.next/cache \
        ./ "${HOSTINGER_USER}@${HOSTINGER_HOST}:${REMOTE_PATH}/"
}

# Create backup of current deployment
echo "📦 Creating backup of current deployment..."
run_remote "mkdir -p ${BACKUP_DIR}"
run_remote "cd ${REMOTE_PATH} && tar -czf ${BACKUP_DIR}/backup_${CURRENT_DATE}.tar.gz . --exclude=backups --exclude=node_modules || echo 'Backup failed or no previous deployment'"

# Stop the application (if running with PM2)
echo "🛑 Stopping application..."
run_remote "cd ${REMOTE_PATH} && pm2 stop ${APP_NAME} || echo 'App was not running'"

# Copy application files
echo "📂 Copying application files..."
copy_files

# Create production environment file
echo "⚙️ Setting up production environment..."
cat > .env.production.tmp << EOF
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
RESEND_API_KEY=${RESEND_API_KEY}
NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN}
NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
PLATFORM_COMMISSION_RATE=0.15
PAYMENT_MODE=live
STRIPE_CONNECT_ENABLED=true
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY:-production-admin-key}
EMAIL_FROM="InstaCares <noreply@instacares.com>"
SKIP_ENV_VALIDATION=true
EOF

# Copy environment file to server
scp .env.production.tmp "${HOSTINGER_USER}@${HOSTINGER_HOST}:${REMOTE_PATH}/.env.local"
rm .env.production.tmp

# Install/Update dependencies
echo "📦 Installing dependencies..."
run_remote "cd ${REMOTE_PATH} && npm ci --production=false"

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
run_remote "cd ${REMOTE_PATH} && npx prisma generate"

# Run database migrations/push
echo "🗄️ Updating database schema..."
run_remote "cd ${REMOTE_PATH} && npx prisma db push"

# Build the application
echo "🏗️ Building application..."
run_remote "cd ${REMOTE_PATH} && npm run build:prod"

# Set proper permissions
echo "🔐 Setting file permissions..."
run_remote "cd ${REMOTE_PATH} && find . -type f -exec chmod 644 {} \; && find . -type d -exec chmod 755 {} \;"
run_remote "cd ${REMOTE_PATH} && chmod +x node_modules/.bin/*"

# Start the application with PM2
echo "🚀 Starting application..."
run_remote "cd ${REMOTE_PATH} && pm2 start ecosystem.config.js || pm2 start npm --name ${APP_NAME} -- start"
run_remote "cd ${REMOTE_PATH} && pm2 save"

# Verify deployment
echo "✅ Verifying deployment..."
sleep 10
if run_remote "cd ${REMOTE_PATH} && pm2 list | grep ${APP_NAME} | grep online"; then
    echo "✅ Deployment successful! Application is running."
    
    # Clean up old backups (keep only last 5)
    run_remote "cd ${BACKUP_DIR} && ls -t backup_*.tar.gz | tail -n +6 | xargs rm -f || echo 'No old backups to clean'"
    
else
    echo "❌ Deployment failed! Application is not running."
    echo "🔄 Attempting to rollback..."
    
    # Rollback to previous version
    LATEST_BACKUP=$(run_remote "cd ${BACKUP_DIR} && ls -t backup_*.tar.gz | head -n 1")
    if [ ! -z "$LATEST_BACKUP" ]; then
        echo "🔄 Rolling back to: $LATEST_BACKUP"
        run_remote "cd ${REMOTE_PATH} && tar -xzf ${BACKUP_DIR}/${LATEST_BACKUP}"
        run_remote "cd ${REMOTE_PATH} && pm2 restart ${APP_NAME}"
    fi
    
    exit 1
fi

echo "🎉 InstaCares deployment completed successfully!"
echo "🌐 Your application should be available at: ${NEXT_PUBLIC_BASE_URL}"