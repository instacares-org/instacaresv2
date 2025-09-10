#!/bin/bash

# Script to update Mapbox token in production
# Usage: ./update-mapbox-token.sh "your-new-mapbox-token"

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide your Mapbox token"
    echo "Usage: ./update-mapbox-token.sh \"pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsc29tZXRva2VuIn0.xxxxx\""
    exit 1
fi

NEW_TOKEN="$1"

echo "🗺️ Updating Mapbox token..."

# Update local .env file
if [ -f .env ]; then
    sed -i.backup "s|NEXT_PUBLIC_MAPBOX_TOKEN=.*|NEXT_PUBLIC_MAPBOX_TOKEN=\"$NEW_TOKEN\"|g" .env
    echo "✅ Updated .env"
fi

# Update .env.production  
if [ -f .env.production ]; then
    sed -i.backup "s|NEXT_PUBLIC_MAPBOX_TOKEN=.*|NEXT_PUBLIC_MAPBOX_TOKEN=\"$NEW_TOKEN\"|g" .env.production
    echo "✅ Updated .env.production"
fi

# Update .env.example for documentation
if [ -f .env.example ]; then
    sed -i.backup "s|NEXT_PUBLIC_MAPBOX_TOKEN=.*|NEXT_PUBLIC_MAPBOX_TOKEN=\"your_mapbox_public_token_here\"|g" .env.example
    echo "✅ Updated .env.example"
fi

echo ""
echo "📋 Token updated locally. Now you need to:"
echo "1. Commit and push these changes"
echo "2. Deploy to production"
echo ""
echo "Run these commands:"
echo "  git add .env .env.production"
echo "  git commit -m \"Update Mapbox token to valid account\""
echo "  git push origin main"
echo ""
echo "The GitHub Actions will automatically deploy with the new token."