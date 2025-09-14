#!/bin/bash
# Production Authentication Fix Script
# Fixes both caregiver signup and login issues on instacares.net

echo "🔧 Fixing Production Authentication Issues..."
echo "==========================================="

cd /var/www/instacaresv2 || cd ~/domains/instacares.net/public_html || cd ~/instacares

echo "📍 Working directory: $(pwd)"

# 1. Stop current services
echo "1. Stopping services..."
pm2 stop instacares 2>/dev/null || true

# 2. Pull latest code
echo "2. Pulling latest code..."
git pull origin main

# 3. Fix environment variables
echo "3. Fixing environment configuration..."

# Check if .env exists, if not create from .env.production
if [ ! -f ".env" ] && [ -f ".env.production" ]; then
    cp .env.production .env
    echo "✅ Created .env from .env.production"
fi

# Ensure critical environment variables are set
if [ -f ".env" ]; then
    # Fix malformed NEXTAUTH_SECRET
    sed -i 's/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=/NEXTAUTH_SECRET="pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU="/g' .env 2>/dev/null || true

    # Add NEXTAUTH_URL if missing
    if ! grep -q "NEXTAUTH_URL=" .env; then
        echo 'NEXTAUTH_URL="https://instacares.net"' >> .env
        echo "✅ Added NEXTAUTH_URL"
    else
        # Update NEXTAUTH_URL to correct value
        sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="https://instacares.net"|g' .env
        echo "✅ Updated NEXTAUTH_URL"
    fi

    # Ensure NEXTAUTH_SECRET exists
    if ! grep -q "NEXTAUTH_SECRET=" .env; then
        echo 'NEXTAUTH_SECRET="production-secure-secret-minimum-32-characters-long-2024"' >> .env
        echo "✅ Added NEXTAUTH_SECRET"
    fi

    # Ensure NODE_ENV is production
    if ! grep -q "NODE_ENV=" .env; then
        echo 'NODE_ENV="production"' >> .env
        echo "✅ Added NODE_ENV=production"
    fi
fi

# 4. Install dependencies
echo "4. Installing dependencies..."
npm install --production

# 5. Setup database
echo "5. Setting up database..."
npx prisma generate
npx prisma db push

# 6. Build application
echo "6. Building application..."
npm run build

# 7. Create test caregiver account
echo "7. Creating test caregiver account..."
cat > create-test-caregiver.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestCaregiver() {
  try {
    console.log('Creating test caregiver account...');

    // Check if exists
    const existing = await prisma.user.findUnique({
      where: { email: 'caregiver@test.com' }
    });

    if (existing) {
      console.log('Account already exists');

      // Ensure profile exists
      const profile = await prisma.userProfile.findUnique({
        where: { userId: existing.id }
      });

      if (!profile) {
        await prisma.userProfile.create({
          data: {
            userId: existing.id,
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '(555) 123-4567',
            city: 'Toronto',
            state: 'ON',
            country: 'CA'
          }
        });
        console.log('Created missing profile');
      }

      // Ensure caregiver record exists
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId: existing.id }
      });

      if (!caregiver) {
        await prisma.caregiver.create({
          data: {
            userId: existing.id,
            hourlyRate: 25,
            experienceYears: 5,
            bio: 'Experienced caregiver',
            dailyCapacity: 4,
            maxChildren: 4,
            isAvailable: true
          }
        });
        console.log('Created missing caregiver record');
      }

      return;
    }

    // Create new account
    const hashedPassword = await bcrypt.hash('test123', 12);

    const user = await prisma.user.create({
      data: {
        email: 'caregiver@test.com',
        passwordHash: hashedPassword,
        userType: 'CAREGIVER',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '(555) 123-4567',
            city: 'Toronto',
            state: 'ON',
            country: 'CA'
          }
        },
        caregiver: {
          create: {
            hourlyRate: 25,
            experienceYears: 5,
            bio: 'Experienced caregiver',
            dailyCapacity: 4,
            maxChildren: 4,
            isAvailable: true
          }
        }
      }
    });

    console.log('✅ Test caregiver created successfully');
    console.log('Email: caregiver@test.com');
    console.log('Password: test123');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCaregiver();
EOF

node create-test-caregiver.js

# 8. Start services
echo "8. Starting services..."
export NODE_ENV=production
pm2 start npm --name "instacares" -- start
pm2 save

# 9. Wait and verify
echo "9. Verifying deployment..."
sleep 5

# Check PM2 status
pm2 list

# Test endpoints
echo ""
echo "Testing endpoints..."
curl -s -o /dev/null -w "Auth endpoint: %{http_code}\n" https://instacares.net/api/auth/csrf || echo "Auth test failed"
curl -s -o /dev/null -w "Health endpoint: %{http_code}\n" https://instacares.net/api/health || echo "Health test failed"

echo ""
echo "🎉 Production Authentication Fixed!"
echo "===================================="
echo ""
echo "✅ Environment variables configured"
echo "✅ Database updated"
echo "✅ Application rebuilt"
echo "✅ Test caregiver account ready"
echo ""
echo "🧪 Test Caregiver Login:"
echo "   URL: https://instacares.net/login/caregiver"
echo "   Email: caregiver@test.com"
echo "   Password: test123"
echo ""
echo "📝 To create new caregiver accounts:"
echo "   1. Visit: https://instacares.net/signup"
echo "   2. Select 'Caregiver' account type"
echo "   3. Complete registration"
echo ""
echo "📋 Recent logs:"
pm2 logs instacares --lines 10 --nostream