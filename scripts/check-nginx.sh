#!/bin/bash

# Simple nginx check script for Hostinger deployment
# This script checks if nginx is configured without failing the deployment

echo "🔍 Checking nginx status..."

# Check if nginx is installed
if command -v nginx >/dev/null 2>&1; then
    echo "✅ Nginx is installed"
    
    # Check if nginx is running
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx is running"
        
        # Check if it's proxying to our app
        if sudo nginx -T 2>/dev/null | grep -q "proxy_pass.*3005"; then
            echo "✅ Nginx is configured to proxy to port 3005"
        else
            echo "⚠️ Nginx might not be configured for port 3005 (Hostinger may handle this differently)"
        fi
    else
        echo "⚠️ Nginx is not running (Hostinger may manage this differently)"
    fi
else
    echo "⚠️ Nginx not found (Hostinger may use a different setup)"
fi

# Check if the app is accessible
echo ""
echo "🔍 Checking app accessibility..."

# Check local connection
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3005 | grep -q "200\|301\|302"; then
    echo "✅ App is accessible on localhost:3005"
else
    echo "⚠️ App might not be running on localhost:3005 yet"
fi

# Always exit with success - this is just a check, not a requirement
echo ""
echo "✅ Nginx check complete (any warnings above are usually fine)"
exit 0