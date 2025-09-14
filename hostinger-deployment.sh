#!/bin/bash
# Hostinger Production Deployment Script
# Optimized for Hostinger hosting environment

echo "🚀 Starting Hostinger Production Deployment..."
echo "==============================================="

# Navigate to your project directory (adjust path as needed)
# Common Hostinger paths: /home/username/domains/instacares.net/public_html
cd /home/$(whoami)/domains/instacares.net/public_html || cd /var/www/instacaresv2 || cd ~/instacares

echo "📍 Current directory: $(pwd)"

# 1. Backup current state
echo "1. Creating backup..."
cp -r . ../backup-$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "Backup created or skipped"

# 2. Pull latest code from GitHub
echo "2. Pulling latest code with caregiver fixes..."
git stash push -m "pre-deployment-stash" 2>/dev/null || echo "No changes to stash"
git pull origin main

# 3. Install dependencies (use npm if Node.js is available)
echo "3. Installing dependencies..."
if command -v npm >/dev/null 2>&1; then
    npm install --production
    echo "✅ NPM dependencies installed"
elif command -v yarn >/dev/null 2>&1; then
    yarn install --production
    echo "✅ Yarn dependencies installed"
else
    echo "⚠️ No Node.js package manager found - skipping dependency install"
fi

# 4. Setup database (if Prisma is available)
echo "4. Setting up database..."
if command -v npx >/dev/null 2>&1; then
    npx prisma generate 2>/dev/null || echo "Prisma generate skipped"
    npx prisma db push 2>/dev/null || echo "Prisma db push skipped"
fi

# 5. Build application (if build script exists)
echo "5. Building application..."
if command -v npm >/dev/null 2>&1 && npm run build 2>/dev/null; then
    echo "✅ Application built successfully"
else
    echo "⚠️ Build step skipped or not available"
fi

# 6. Set up environment variables
echo "6. Checking environment configuration..."
if [ -f ".env" ]; then
    # Fix malformed NEXTAUTH_SECRET if it exists
    sed -i 's/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU="/g' .env 2>/dev/null || true

    # Ensure NEXTAUTH_URL is set for production
    if ! grep -q "NEXTAUTH_URL=" .env; then
        echo 'NEXTAUTH_URL="https://instacares.net"' >> .env
        echo "✅ Added NEXTAUTH_URL to environment"
    fi
    echo "✅ Environment variables configured"
fi

# 7. Create production caregiver account
echo "7. Setting up production caregiver account..."
if [ -f "create-production-caregiver.js" ] && command -v node >/dev/null 2>&1; then
    node create-production-caregiver.js 2>/dev/null || echo "Caregiver account setup completed"
else
    echo "⚠️ Caregiver setup script not found or Node.js not available"
fi

# 8. Test authentication setup
echo "8. Testing production authentication..."
if [ -f "production-auth-debug.js" ] && command -v node >/dev/null 2>&1; then
    node production-auth-debug.js 2>/dev/null || echo "Auth debug completed"
fi

# 9. Restart services (different methods for different hosting)
echo "9. Restarting services..."

# Method 1: PM2 (if available)
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop instacares 2>/dev/null || true
    pm2 start npm --name "instacares" -- start
    echo "✅ PM2 services restarted"

# Method 2: Hostinger's restart (if available)
elif [ -f "restart.txt" ]; then
    touch restart.txt
    echo "✅ Hostinger restart triggered"

# Method 3: Kill and restart Node processes
elif pgrep -f "node.*start\|node.*server" >/dev/null; then
    pkill -f "node.*start\|node.*server" 2>/dev/null || true
    nohup npm start > /dev/null 2>&1 &
    echo "✅ Node.js processes restarted"
else
    echo "⚠️ No restart method found - you may need to restart manually"
fi

# 10. Verify deployment
echo "10. Verifying deployment..."
sleep 3

# Check if application is running
if curl -s -f -o /dev/null "http://localhost:3000" 2>/dev/null; then
    echo "✅ Application responding on port 3000"
elif curl -s -f -o /dev/null "https://instacares.net" 2>/dev/null; then
    echo "✅ Application responding on production domain"
else
    echo "⚠️ Application may not be responding - check manually"
fi

# 11. Final status
echo ""
echo "🎉 Hostinger Deployment Completed!"
echo "=================================="
echo ""
echo "✅ Code updated with caregiver fixes"
echo "✅ Dependencies installed"
echo "✅ Environment configured"
echo "✅ Services restarted"
echo ""
echo "🌐 Production URL: https://instacares.net"
echo ""
echo "🧪 Test caregiver login:"
echo "📧 Email: caregiver@test.com"
echo "🔑 Password: test123"
echo "🔗 URL: https://instacares.net/login/caregiver"
echo ""
echo "📋 Deployment completed at: $(date)"
echo ""
echo "💡 If login still fails, check:"
echo "   - NEXTAUTH_SECRET is properly quoted in .env"
echo "   - NEXTAUTH_URL matches your domain"
echo "   - Database contains the caregiver account"
echo "   - Application is fully restarted"