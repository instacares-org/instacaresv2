#!/bin/bash

echo "🚨 Emergency deployment fix starting..."

# Stop everything first
echo "⏹️ Stopping all services..."
pm2 stop all || true
pm2 delete all || true
pm2 kill || true
sleep 3

# Kill any remaining processes
echo "🔫 Killing remaining processes..."
pkill -f 'node.*3000' || true
pkill -f 'node.*3005' || true
pkill -f 'next' || true
sleep 2

# Navigate to project directory
echo "📁 Navigating to project directory..."
cd /var/www/instacaresv2 || exit 1

# Update code from git
echo "📥 Pulling latest code..."
git pull origin main || echo "Git pull failed, continuing..."

# Restore production environment
echo "🔄 Setting up production environment..."
if [ -f .env.production ]; then
    cp .env.production .env
    echo "✅ Production .env restored"
else
    echo "⚠️ No .env.production found - using default"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install || echo "npm install failed, continuing..."

# Build the application
echo "🏗️ Building application..."
npm run build || echo "Build failed, continuing..."

# Configure nginx
echo "🔧 Configuring nginx..."
chmod +x scripts/fix-nginx-config.sh
./scripts/fix-nginx-config.sh || echo "Nginx config failed, continuing..."

# Restart nginx
echo "🔄 Restarting nginx..."
systemctl restart nginx || echo "Nginx restart failed"

# Start the application using ecosystem config
echo "▶️ Starting application with PM2..."
pm2 start ecosystem.config.js --env production || echo "PM2 start failed"

# Save PM2 configuration
pm2 save || echo "PM2 save failed"

# Wait a moment for startup
echo "⏳ Waiting for application to start..."
sleep 5

# Check status
echo "📊 Final status check..."
pm2 status
echo ""
echo "🔍 Testing local connection..."
curl -I http://localhost:3005 || echo "Local connection failed"

echo "✅ Emergency deployment completed!"