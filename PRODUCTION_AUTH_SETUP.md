# Production Authentication Setup Guide

## 🚨 Critical: NextAuth Environment Variables

The production server authentication failures are caused by missing NextAuth environment variables.

### ✅ Fixed Issues:
1. **Missing NEXTAUTH_URL** - Now set to `https://instacares.net`
2. **Missing NEXTAUTH_SECRET** - Added secure 32+ character secret
3. **Missing OAuth providers** - Added Google/Facebook placeholder configs

### 🔧 Required Production Environment Variables

Update your production server environment with these values:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL="https://instacares.net"
NEXTAUTH_SECRET="production-nextauth-secret-minimum-32-chars-long-secure-2024"

# OAuth Providers (replace with real values)
GOOGLE_CLIENT_ID="your_real_google_client_id"
GOOGLE_CLIENT_SECRET="your_real_google_client_secret"
FACEBOOK_CLIENT_ID="your_real_facebook_client_id"
FACEBOOK_CLIENT_SECRET="your_real_facebook_client_secret"
```

### 🎯 Test Caregiver Account

After fixing environment variables, test with:
- **Email**: `caregiver@test.com`
- **Password**: `test123`
- **URL**: `https://instacares.net/login/caregiver`

### 📋 Deployment Steps

1. **Update production environment variables** with the values from `.env.production`
2. **Restart the production server** to load new environment variables
3. **Test authentication flow** with caregiver credentials
4. **Verify dashboard functionality** - Schedule & Messages tabs should work

### 🔍 Authentication Flow

1. User visits `/login/caregiver`
2. Enters credentials → NextAuth credentials provider
3. Creates session → Redirects to `/caregiver-dashboard`
4. Dashboard calls `/api/caregiver/profile` with session cookies
5. API validates session and returns caregiver data

### 🚨 Still Getting 401 Errors?

If authentication still fails after environment variable updates:

1. **Check server logs** for specific NextAuth errors
2. **Verify database connection** - caregiver profile must exist
3. **Clear browser cookies** and try fresh login
4. **Check CORS settings** for cross-origin issues

### 💡 OAuth Setup (Optional)

To enable Google/Facebook login:

1. **Google**: https://console.developers.google.com/
2. **Facebook**: https://developers.facebook.com/
3. Update redirect URIs to `https://instacares.net/api/auth/callback/google`
4. Replace placeholder OAuth credentials in production env

## 🔄 Next Steps

1. Apply environment variable changes to production
2. Restart production server
3. Test caregiver authentication
4. Monitor for remaining 401 errors
5. Create additional test accounts if needed