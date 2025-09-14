#!/bin/bash
# Emergency Server Recovery Script
# Run this on your production server to fix the Bad Gateway error

echo "🚨 Emergency Server Recovery Starting..."
echo "========================================"

cd /var/www/instacaresv2

# 1. Stop all processes
echo "1. Stopping all PM2 processes..."
pm2 stop all
pm2 delete all

# 2. Check and fix environment files
echo "2. Fixing environment configuration..."

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Fix the malformed NEXTAUTH_SECRET in .env
sed -i 's/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU="/g' .env

# Remove duplicate NEXTAUTH entries
sed -i '/^NEXTAUTH_URL="https:\/\/instacares.net"$/N;/^NEXTAUTH_URL="https:\/\/instacares.net"\nNEXTAUTH_SECRET=/d' .env

# 3. Install dependencies
echo "3. Installing/updating dependencies..."
npm install --production

# 4. Build the application
echo "4. Building Next.js application..."
npm run build

# 5. Set proper environment
echo "5. Setting production environment..."
export NODE_ENV=production

# 6. Start with PM2
echo "6. Starting application with PM2..."
pm2 start npm --name "instacares" -- start

# 7. Verify startup
echo "7. Checking application status..."
sleep 5
pm2 list
pm2 logs instacares --lines 10

# 8. Check if port is listening
echo "8. Checking if application is listening on port 3000..."
if netstat -tlnp | grep -q ":3000"; then
    echo "✅ Application is listening on port 3000"
else
    echo "❌ Application is NOT listening on port 3000"
    echo "PM2 Logs:"
    pm2 logs instacares --lines 20
fi

# 9. Test HTTP response
echo "9. Testing HTTP response..."
curl -I http://localhost:3000 || echo "❌ HTTP test failed"

echo ""
echo "🔧 Recovery script completed!"
echo "Check https://instacares.net to verify the site is working"
echo ""
echo "If still having issues, run:"
echo "  pm2 logs instacares --lines 50"
echo "  node production-auth-debug.js"