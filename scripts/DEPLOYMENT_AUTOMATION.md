# 🚀 InstaCares Automated Deployment Guide

This guide provides multiple automated deployment solutions for your Hostinger server, eliminating the need for manual pull commands.

## 📋 Overview

We've created several automation scripts that will:
- ✅ Automatically pull latest code from GitHub
- ✅ Install/update dependencies 
- ✅ Build the application
- ✅ Update database schema
- ✅ Restart services with PM2
- ✅ Perform health checks
- ✅ Create backups (optional)
- ✅ Clean up temporary files

## 🛠️ Setup Options

### Option 1: Manual Command (Recommended to start)

**Step 1:** SSH into your Hostinger server
```bash
ssh your-username@your-hostinger-server.com
```

**Step 2:** Navigate to your app directory and run setup
```bash
cd /var/www/instacares
chmod +x scripts/setup-auto-deploy.sh
./scripts/setup-auto-deploy.sh
```

**Step 3:** Deploy manually whenever you want
```bash
# Simple deployment
instacares-deploy

# Or use the alias
deploy
```

### Option 2: Cron Job (Automated every 5 minutes)

**After completing Option 1 setup:**

```bash
# Set up cron job to check for updates every 5 minutes
echo '*/5 * * * * /usr/local/bin/instacares-deploy' | crontab -

# View your cron jobs
crontab -l

# Edit cron jobs if needed
crontab -e
```

### Option 3: GitHub Webhooks (Instant deployment)

**Step 1:** Upload the webhook script to your Hostinger public_html
```bash
# Copy webhook-deploy.php to your web directory
cp /var/www/instacares/scripts/webhook-deploy.php /home/your-username/public_html/
```

**Step 2:** Configure the webhook secret
```bash
# Edit the webhook file
nano /home/your-username/public_html/webhook-deploy.php

# Change this line:
const SECRET = 'your-webhook-secret-here';
# To something secure like:
const SECRET = 'your-super-secure-secret-key-2024';
```

**Step 3:** Set up GitHub webhook
1. Go to your GitHub repository: https://github.com/instacares-org/instacaresv2
2. Go to Settings → Webhooks
3. Click "Add webhook"
4. Set Payload URL: `https://yourdomain.com/webhook-deploy.php`
5. Set Content type: `application/json`
6. Set Secret: Same as what you put in the PHP file
7. Select "Just the push event"
8. Make sure "Active" is checked
9. Click "Add webhook"

**Step 4:** Test the webhook
```bash
# Check webhook logs
tail -f /var/log/webhook-deploy.log
```

Now every time you push to GitHub, it will automatically deploy to your server!

## 📖 Command Reference

### Deployment Commands

```bash
# Basic deployment (checks for updates first)
instacares-deploy

# Force deployment (deploy even if no changes)
instacares-deploy --force

# Restart only (don't pull code or rebuild)
instacares-deploy --restart-only

# Create backup before deployment
instacares-deploy --backup

# Combine options
instacares-deploy --force --backup
```

### Monitoring Commands

```bash
# View running processes
pm2 list

# View application logs
pm2 logs instacares

# Monitor applications in real-time
pm2 monit

# View deployment logs
tail -f /var/log/instacares-deploy.log

# View webhook logs (if using webhooks)
tail -f /var/log/webhook-deploy.log
```

### Troubleshooting Commands

```bash
# Restart PM2 processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes and restart
pm2 delete all
instacares-deploy --force

# Check system resources
htop
df -h
free -h

# Check if ports are in use
netstat -tulpn | grep :3000
netstat -tulpn | grep :3007
```

## 🔧 Configuration

### Environment Variables

Make sure these are set in your server's environment:

```bash
# In /var/www/instacares/.env
NODE_ENV=production
DATABASE_URL="your-production-database-url"
NEXT_PUBLIC_MAPBOX_TOKEN="your-production-mapbox-token"
JWT_SECRET="your-jwt-secret"
# ... other production variables
```

### PM2 Ecosystem Configuration

The deployment uses the `ecosystem.config.js` file for PM2 configuration:

```javascript
module.exports = {
  apps: [{
    name: 'instacares',
    script: 'server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

## 🚨 Security Notes

1. **File Permissions**: The deployment script creates log files with appropriate permissions
2. **Backup Strategy**: Use `--backup` flag for important deployments
3. **Webhook Security**: Always set a strong secret for GitHub webhooks
4. **Server Access**: Limit SSH access to your server
5. **Environment Variables**: Never commit sensitive data to the repository

## 📊 Monitoring & Logs

### Log Files Locations

```bash
# Deployment logs
/var/log/instacares-deploy.log

# Webhook logs
/var/log/webhook-deploy.log

# PM2 logs
~/.pm2/logs/instacares-out.log
~/.pm2/logs/instacares-error.log
```

### Health Checks

The deployment script automatically performs health checks:
- ✅ Verifies PM2 processes are running
- ✅ Tests HTTP responses
- ✅ Checks WebSocket server status

## 🔄 Rollback Strategy

If something goes wrong:

```bash
# Stop current deployment
pm2 stop all

# Restore from backup (if created)
cd /var/backups/instacares
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz -C /var/www/instacares/

# Restart with previous version
pm2 start ecosystem.config.js
```

## 🆘 Common Issues & Solutions

### Issue: "Permission denied"
```bash
# Fix file permissions
sudo chown -R $(whoami):$(whoami) /var/www/instacares
chmod +x /var/www/instacares/scripts/auto-deploy-hostinger.sh
```

### Issue: "Port already in use"
```bash
# Kill processes on ports
sudo fuser -k 3000/tcp
sudo fuser -k 3007/tcp
instacares-deploy --restart-only
```

### Issue: "npm install fails"
```bash
# Clear npm cache and reinstall
cd /var/www/instacares
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: "Database connection fails"
```bash
# Check database file permissions
ls -la /var/www/instacares/prisma/
# Regenerate Prisma client
npx prisma generate
```

## 📞 Support

If you need help with deployment:

1. **Check the logs** first: `tail -f /var/log/instacares-deploy.log`
2. **Verify PM2 status**: `pm2 list`
3. **Test manual deployment**: `instacares-deploy --force`
4. **Check GitHub webhook** (if using): `curl -X GET https://yourdomain.com/webhook-deploy.php`

## 🎉 Success Indicators

Your automated deployment is working correctly when you see:

- ✅ `pm2 list` shows `instacares` and `instacares-websocket` as `online`
- ✅ Your website loads at your domain
- ✅ No errors in `/var/log/instacares-deploy.log`
- ✅ GitHub webhook shows green checkmarks
- ✅ Automatic deployments happen within 5 minutes of pushing code

---

**Congratulations! Your InstaCares platform now has enterprise-level automated deployment! 🚀**