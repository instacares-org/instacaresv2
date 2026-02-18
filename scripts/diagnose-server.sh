#!/bin/bash

echo "🔍 Diagnosing server issues..."

echo "📊 Checking PM2 status:"
pm2 status

echo ""
echo "🔍 Checking if port 3005 is in use:"
lsof -i :3005 || echo "Port 3005 is not in use"

echo ""
echo "🔍 Checking if port 3000 is in use:"
lsof -i :3000 || echo "Port 3000 is not in use"

echo ""
echo "📋 Checking nginx status:"
systemctl status nginx

echo ""
echo "🔍 Checking nginx configuration:"
nginx -t

echo ""
echo "📁 Checking if application directory exists:"
ls -la /var/www/instacaresv2/ || echo "Directory not found"

echo ""
echo "🔍 Checking last few lines of nginx error log:"
tail -10 /var/log/nginx/error.log || echo "Cannot read nginx error log"

echo ""
echo "🔍 Checking if Next.js build exists:"
ls -la /var/www/instacaresv2/.next || echo ".next directory not found"

echo ""
echo "📦 Checking package.json scripts:"
cd /var/www/instacaresv2 && cat package.json | grep -A5 '"scripts"' || echo "Cannot read package.json"

echo ""
echo "🔍 Testing local connection:"
curl -I http://localhost:3005 || echo "Cannot connect to localhost:3005"

echo ""
echo "✅ Diagnosis complete!"