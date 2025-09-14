# 🚨 Server Recovery Guide

Your server is showing "Bad Gateway" because the application crashed. Here are the emergency fixes:

## 🔥 **IMMEDIATE FIX - Run This First:**

```bash
cd /var/www/instacaresv2
chmod +x emergency-server-fix.sh
./emergency-server-fix.sh
```

This script will:
- ✅ Stop crashed PM2 processes
- ✅ Fix the malformed NEXTAUTH_SECRET in .env
- ✅ Remove duplicate environment variables
- ✅ Rebuild and restart the application
- ✅ Verify it's working on port 3000

## 🚀 **FULL DEPLOYMENT FIX:**

If you want to pull the latest code and apply all fixes:

```bash
cd /var/www/instacaresv2
chmod +x deploy-fix.sh
./deploy-fix.sh
```

This will:
- ✅ Pull latest code from GitHub
- ✅ Install dependencies and build
- ✅ Apply all environment fixes
- ✅ Create test caregiver account
- ✅ Start services properly

## 🔍 **What Went Wrong:**

1. **Malformed Environment Variable:**
   ```bash
   NEXTAUTH_SECRET="pjhaNa/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=
   ```
   *(Missing closing quote broke environment parsing)*

2. **Duplicate NEXTAUTH entries** causing conflicts

3. **PM2 restart without proper environment** loading

## 🎯 **After Recovery - Test Authentication:**

Once the server is running, test the caregiver login:
- **URL**: https://instacares.net/login/caregiver
- **Email**: caregiver@test.com
- **Password**: test123

## 🛠️ **Manual Recovery (if scripts fail):**

```bash
# 1. Stop everything
pm2 stop all && pm2 delete all

# 2. Fix environment manually
nano .env
# Find line 127: NEXTAUTH_SECRET="pjhaNa/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU=
# Add closing quote: NEXTAUTH_SECRET="pjhaNa/1et24A3nsQrMLqRCEIpHHHJuGu5TQvMbuSdU="
# Remove duplicate NEXTAUTH lines (128-129)

# 3. Rebuild and restart
npm run build
pm2 start npm --name "instacares" -- start
```

## 🚨 **Emergency Contacts:**

If still having issues, check:
- `pm2 logs instacares --lines 50` - See error logs
- `node production-auth-debug.js` - Check environment
- `netstat -tlnp | grep 3000` - Verify port 3000 is listening

## 📋 **Prevention:**

Moving forward:
1. Always test environment changes in staging first
2. Use `.env.production` for production-specific variables
3. Backup before making PM2 changes
4. Monitor PM2 logs during deployments