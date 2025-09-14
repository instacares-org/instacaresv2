# 🚨 Emergency Production Fix Guide

## Critical Server Issues Fixed
Your InstaCares production server at `instacares.net` was experiencing multiple critical issues:
- **Malformed NEXTAUTH_SECRET** causing authentication failures
- **Missing Tailwind CSS dependencies** causing build failures
- **Production build errors** preventing startup
- **PM2 configuration issues**

## 🎯 Quick Fix Commands

### Option 1: Emergency Production Fix (Recommended)
```bash
# SSH into your server
ssh root@72.60.71.43

# Navigate to project directory (try these paths in order)
cd /var/www/instacaresv2 || cd ~/domains/instacares.net/public_html || cd ~/instacares

# Pull latest fixes from GitHub
git pull origin main

# Make script executable and run emergency fix
chmod +x emergency-production-fix.sh
./emergency-production-fix.sh
```

### Option 2: Clean Environment + Deploy
```bash
# First, clean up environment files
chmod +x cleanup-hostinger-env.sh
./cleanup-hostinger-env.sh

# Then run authentication fix
chmod +x fix-production-auth.sh
./fix-production-auth.sh
```

## 🔧 What The Emergency Fix Does

1. **Stops all PM2 processes** to ensure clean restart
2. **Fixes malformed NEXTAUTH_SECRET** with proper syntax
3. **Installs ALL dependencies** including Tailwind CSS packages
4. **Cleans old build files** (.next directory)
5. **Generates Prisma client** for database
6. **Builds application** with fallback options
7. **Configures PM2** with proper environment variables
8. **Creates test caregiver account** for verification
9. **Tests endpoints** to verify functionality

## 🧪 Verification Steps

After running the fix, verify everything works:

### 1. Check PM2 Status
```bash
pm2 list
pm2 logs instacares --lines 20
```

### 2. Test Website
- Visit: https://instacares.net
- Should show homepage without errors

### 3. Test Caregiver Login
- URL: https://instacares.net/login/caregiver
- Email: `caregiver@test.com`
- Password: `test123`

### 4. Test API Endpoints
```bash
curl -s -o /dev/null -w "Auth endpoint: %{http_code}\n" https://instacares.net/api/auth/csrf
curl -s -o /dev/null -w "Health endpoint: %{http_code}\n" https://instacares.net/api/health
```

## 🚨 If Issues Persist

### Check Logs
```bash
pm2 logs instacares --lines 50
grep NEXTAUTH .env
ls -la .next/
```

### Restart Application
```bash
pm2 restart instacares
pm2 save
```

### Manual Environment Fix
If environment issues persist:
```bash
# Check current environment
cat .env | grep NEXTAUTH

# Fix NEXTAUTH_SECRET manually if needed
sed -i 's/NEXTAUTH_SECRET=\"pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=/NEXTAUTH_SECRET=\"pjhaNa\/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=\"/g' .env
```

## 📋 Environment Files Cleanup

The `cleanup-hostinger-env.sh` script will:
- Move all backup .env files to a backup directory
- Keep only `.env` and `.env.production`
- Verify critical environment variables are set
- Show cleanup summary

## ✅ Success Indicators

You'll know it's working when:
- PM2 shows `instacares` as `online`
- https://instacares.net loads without "Bad Gateway" error
- Caregiver login works at https://instacares.net/login/caregiver
- Test account (`caregiver@test.com` / `test123`) can log in successfully

## 🔄 Future Deployments

For future deployments, use the stable scripts:
1. `cleanup-hostinger-env.sh` - Clean environment files
2. `fix-production-auth.sh` - Standard deployment with auth fixes
3. `emergency-production-fix.sh` - Emergency recovery only

## 📞 Support

If you encounter any issues after running these scripts:
1. Check PM2 logs: `pm2 logs instacares --lines 50`
2. Verify .env file: `grep NEXTAUTH .env`
3. Test endpoints manually
4. Contact support with specific error messages

---
**Last Updated:** September 2024
**Scripts Location:** Root directory of InstaCares repository
**Production Server:** instacares.net (Hostinger)