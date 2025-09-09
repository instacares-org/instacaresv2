# Fix Google OAuth Chrome Security Warning

## Problem
Chrome shows a "Dangerous site" warning when clicking the Google login button because the OAuth redirect URIs are not properly configured.

## Solution Steps

### 1. Update Google Cloud Console Settings

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and update your OAuth 2.0 Client ID:

#### Authorized JavaScript origins:
Add ALL of these:
```
https://instacares.net
https://www.instacares.net
http://localhost:3005
```

#### Authorized redirect URIs:
Add ALL of these (EXACT URLs - copy/paste them):
```
https://instacares.net/api/auth/callback/google
https://www.instacares.net/api/auth/callback/google
http://localhost:3005/api/auth/callback/google
```

### 2. Update Production Environment Variables

On your Hostinger server, update the `.env.production` file with:

```bash
# NextAuth Configuration
NEXTAUTH_URL="https://instacares.net"
NEXTAUTH_SECRET="[your-generated-secret-here]"

# Google OAuth
GOOGLE_CLIENT_ID="[your-google-client-id]"
GOOGLE_CLIENT_SECRET="[your-google-client-secret]"
```

**IMPORTANT**: 
- `NEXTAUTH_URL` must be `https://instacares.net` (not http://)
- Generate a secure `NEXTAUTH_SECRET` with: `openssl rand -base64 32`

### 3. Update Hostinger Server Configuration

SSH into your Hostinger server and run:

```bash
cd /var/www/instacaresv2

# Backup current environment
cp .env .env.backup.oauth

# Edit the production environment file
nano .env.production

# Add/update these lines:
NEXTAUTH_URL="https://instacares.net"
NEXTAUTH_SECRET="[your-generated-secret]"
GOOGLE_CLIENT_ID="[your-google-client-id]"
GOOGLE_CLIENT_SECRET="[your-google-client-secret]"

# Save and exit (Ctrl+X, Y, Enter)

# Copy production env to active env
cp .env.production .env

# Restart the application
pm2 restart instacares
```

### 4. Verify SSL Certificate

The site must be served over HTTPS. Check your SSL certificate:

```bash
# Check SSL certificate
curl -I https://instacares.net

# Should see: HTTP/2 200 or HTTP/1.1 200 OK
```

### 5. Clear Chrome Security Cache

After making changes:
1. Open Chrome
2. Go to `chrome://settings/security`
3. Click "Manage certificates" if available
4. Clear browsing data (Ctrl+Shift+Delete)
5. Select "Cached images and files"
6. Clear data

### 6. Test the Fix

1. Visit https://instacares.net in an incognito window
2. Click the Google login button
3. Should redirect to Google's OAuth consent screen without warnings

## Common Issues

### Issue: Still getting security warning
**Solution**: Make sure the redirect URI in Google Console EXACTLY matches:
- `https://instacares.net/api/auth/callback/google` (not http://)
- No trailing slashes
- Exact domain (with or without www based on your setup)

### Issue: Google OAuth error "redirect_uri_mismatch"
**Solution**: The redirect URI doesn't match. Check:
1. Your `NEXTAUTH_URL` in production
2. The authorized redirect URIs in Google Console
3. They must match EXACTLY

### Issue: "The connection is not private" error
**Solution**: SSL certificate issue. Contact Hostinger support to ensure SSL is properly configured.

## Security Notes

1. **Never commit OAuth secrets to Git**
2. **Always use HTTPS in production**
3. **Rotate secrets regularly**
4. **Use different OAuth apps for dev/staging/production**

## Verification Commands

Run these on your server to verify configuration:

```bash
# Check environment variables are set
grep "NEXTAUTH_URL\|GOOGLE_CLIENT" .env

# Check if app is using correct env
pm2 logs instacares --lines 50 | grep -i "oauth\|google"

# Test OAuth endpoint
curl https://instacares.net/api/auth/providers
```

## Expected Result
After following these steps, clicking the Google login button should:
1. Not trigger any Chrome security warnings
2. Redirect to Google's OAuth consent page
3. Successfully authenticate and redirect back to your site