# Mapbox Development Setup Guide

## Problem Solved

This guide resolves the issue where the same Mapbox token was being used by both:
- **Production**: instacares.net 
- **Local Development**: localhost

This caused conflicts and API rate limiting issues because Mapbox sees concurrent usage from different domains.

## Solution Overview

The application now separates development and production Mapbox usage:

1. **Production** continues using the existing token
2. **Development** uses either:
   - A separate development token (recommended for full functionality)
   - OpenStreetMap fallback (default, prevents conflicts)

## Current Configuration

### Development Environment (.env.local)
```env
# Option 1: Use fallback (current default - no conflicts)
NEXT_PUBLIC_MAPBOX_TOKEN=""

# Option 2: Use development token (full functionality)
# NEXT_PUBLIC_MAPBOX_TOKEN="your_development_token_here"
```

### Production Environment (.env.production)
```env
# Production token (currently active on instacares.net)
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1IjoiZmFyYWR5MDAxIiwiYSI6ImNtZWVpd3MycjBqMTYybXByNTAweTBsenUifQ.7GvBthq5x1TY3O_di67zJQ"
```

## Fallback Mode (Default)

When no Mapbox token is configured, the application automatically uses fallback components:

### Address Autocomplete Fallback
- Manual address entry with helpful guidance
- Defaults to Toronto, ON coordinates
- Clear instructions for enabling full Mapbox functionality

### Map Fallback 
- OpenStreetMap-style visual representation
- Interactive caregiver markers
- Location detection support
- No external API dependencies

## Enabling Full Mapbox Functionality

If you want full Mapbox functionality in development:

### Step 1: Create Development Token
1. Go to [mapbox.com](https://www.mapbox.com/)
2. Sign in to your account (or create one)
3. Navigate to **Account → Access tokens**
4. Click **Create a token**
5. Name it "InstaCares Development"
6. Select the following scopes:
   - `styles:read`
   - `fonts:read`  
   - `datasets:read`
   - `geocoding:read`
7. Add URL restriction: `http://localhost:*` (optional but recommended)

### Step 2: Update Environment
1. Open `.env.local`
2. Replace the empty token:
   ```env
   NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_new_development_token_here"
   ```
3. Restart your development server:
   ```bash
   npm run dev
   ```

### Step 3: Verify
- Address autocomplete should show Mapbox suggestions
- Maps should load interactive Mapbox tiles
- Check browser console for any token-related errors

## Benefits of This Setup

### For Development
- ✅ No conflicts with production usage
- ✅ Reliable fallback mode works offline
- ✅ Optional full Mapbox functionality when needed
- ✅ Clear guidance for developers

### For Production
- ✅ Continues using existing token without interruption
- ✅ No changes needed to production deployment
- ✅ Clear separation of environments

## Token Management Best Practices

### Development Tokens
- Use URL restrictions for security
- Name clearly (e.g., "InstaCares Dev")
- Rotate periodically (every 6 months)
- Don't commit to version control

### Production Tokens  
- Use URL restrictions for security
- Monitor usage in Mapbox dashboard
- Set up billing alerts
- Have backup tokens ready

## Troubleshooting

### No Maps Showing
- Check browser console for errors
- Verify token is correctly set in `.env.local`
- Ensure development server was restarted after env changes

### Address Autocomplete Not Working
- Same as above - token and restart
- Check network tab for failed API calls
- Verify token has `geocoding:read` permission

### Production Issues
- Don't modify the production token
- Test changes in development first
- Monitor Mapbox usage dashboard

## Component Architecture

The application uses graceful degradation:

```
MapboxAddressAutocomplete.tsx
├── Token available? → Use Mapbox API
└── No token? → Manual entry fallback

CaregiverMap.tsx  
├── Token available? → Interactive Mapbox
└── No token? → FallbackMap.tsx (OpenStreetMap style)
```

This ensures the application always works, regardless of Mapbox configuration.