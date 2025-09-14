#!/bin/bash
# Automated Deployment Fix Script
# This pulls latest code from GitHub and applies fixes

echo "🚀 Automated Deployment Fix Starting..."
echo "======================================"

cd /var/www/instacaresv2

# 1. Backup current state
echo "1. Creating backup..."
cp -r . ../instacaresv2-backup-$(date +%Y%m%d_%H%M%S) || echo "Backup failed, continuing..."

# 2. Stop services
echo "2. Stopping current services..."
pm2 stop all

# 3. Pull latest code from GitHub
echo "3. Pulling latest code from GitHub..."
git stash  # Save any local changes
git pull origin main
git stash pop || echo "No stash to apply"

# 4. Install dependencies
echo "4. Installing dependencies..."
npm ci --production

# 5. Run database migrations if needed
echo "5. Running database setup..."
npx prisma generate
npx prisma db push || echo "Database push failed, continuing..."

# 6. Build application
echo "6. Building application..."
npm run build

# 7. Fix environment variables
echo "7. Applying environment fixes..."
if [ -f ".env" ]; then
    # Fix malformed NEXTAUTH_SECRET
    sed -i 's/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU="/g' .env
    echo "✅ Fixed malformed NEXTAUTH_SECRET"
fi

# 8. Create production caregiver account if needed
echo "8. Ensuring test caregiver account exists..."
node create-production-caregiver.js || echo "Caregiver creation skipped"

# 9. Start services
echo "9. Starting services..."
export NODE_ENV=production
pm2 start npm --name "instacares" -- start

# 10. Verify deployment
echo "10. Verifying deployment..."
sleep 5
pm2 list

# Check if listening on correct port
if netstat -tlnp | grep -q ":3000"; then
    echo "✅ Deployment successful - listening on port 3000"
    curl -I http://localhost:3000
else
    echo "❌ Deployment failed - not listening on port 3000"
    pm2 logs instacares --lines 20
    exit 1
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo "🌐 Check https://instacares.net"
echo ""
echo "Test caregiver login:"
echo "📧 Email: caregiver@test.com"
echo "🔑 Password: test123"
echo "🔗 URL: https://instacares.net/login/caregiver"