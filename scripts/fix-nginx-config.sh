#!/bin/bash

# Fix nginx 502 Bad Gateway error for InstaCares
# This script configures nginx to properly proxy to the Node.js app on port 3005

echo "🔧 Fixing nginx configuration for InstaCares..."

# Backup existing nginx config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d-%H%M%S)

# Create nginx configuration for InstaCares
sudo tee /etc/nginx/sites-available/instacares.net > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name instacares.net www.instacares.net;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name instacares.net www.instacares.net;

    # SSL Configuration (Hostinger manages SSL certificates)
    ssl_certificate /etc/ssl/certs/instacares.net.crt;
    ssl_certificate_key /etc/ssl/private/instacares.net.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Root directory (fallback for static files)
    root /var/www/instacaresv2/public;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer sizes
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Next.js static assets
    location /_next/static {
        alias /var/www/instacaresv2/.next/static;
        expires 365d;
        access_log off;
    }

    # Public static files
    location /static {
        alias /var/www/instacaresv2/public;
        expires 30d;
        access_log off;
    }

    # Favicon
    location /favicon.ico {
        alias /var/www/instacaresv2/public/favicon.ico;
        expires 30d;
        access_log off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3005/health;
        access_log off;
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/html;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/instacares.net /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    echo "✅ Nginx configuration updated successfully!"
    echo ""
    echo "📋 Summary:"
    echo "- HTTP requests redirect to HTTPS"
    echo "- HTTPS requests proxy to Node.js app on port 3005"
    echo "- Static files served directly by nginx"
    echo "- Security headers added"
    echo "- Gzip compression enabled"
    echo ""
    echo "🌐 Your site should now be accessible at: https://instacares.net"
    
else
    echo "❌ Nginx configuration has errors. Please check the syntax."
    exit 1
fi

# Check if PM2 app is running
echo "🔍 Checking PM2 status..."
pm2 status

echo "🎯 Testing the connection..."
curl -I http://localhost:3005 || echo "⚠️  App might not be running on port 3005"

echo ""
echo "🚀 Setup complete! Visit https://instacares.net to test."