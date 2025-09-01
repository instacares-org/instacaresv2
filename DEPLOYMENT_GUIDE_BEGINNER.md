# InstaCares Deployment Guide for Beginners 🚀

This guide will walk you through deploying your InstaCares application step-by-step, even if you've never deployed a web application before. Don't worry - we'll explain everything!

## Table of Contents
- [What is Deployment?](#what-is-deployment)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Testing](#local-testing)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## What is Deployment?

**Deployment** is like moving your application from your computer (where only you can see it) to a server on the internet (where everyone can access it). Think of it like publishing a book - you write it at home, but to share it with the world, you need to send it to a publisher who makes it available in stores.

### Key Terms to Know:
- **Local Environment**: Your computer where you develop the app
- **Staging Environment**: A test version of your live website
- **Production Environment**: The live website that users see
- **Server**: A computer that hosts your website 24/7
- **Database**: Where your app stores information (like user accounts, bookings)

---

## Prerequisites

Before we start, make sure you have these things ready:

### ✅ Checklist - Do You Have These?

- [ ] **Your InstaCares project folder** (the one with all your code)
- [ ] **Node.js installed** on your computer
  - Check by running: `node --version` in your terminal
  - Should show version 16 or higher
- [ ] **npm installed** (comes with Node.js)
  - Check by running: `npm --version`
- [ ] **Git installed** and your project in a Git repository
  - Check by running: `git --version`
- [ ] **A hosting account** (like Hostinger, Vercel, or DigitalOcean)
- [ ] **Database access** (MySQL, PostgreSQL, etc.)
- [ ] **All your environment variables** (we'll set these up below)

### 💡 Don't Have Everything Yet?
If you're missing something:
- **Node.js**: Download from [nodejs.org](https://nodejs.org/)
- **Git**: Download from [git-scm.com](https://git-scm.com/)
- **Hosting**: We recommend Hostinger for beginners, or Vercel for easy deployment

---

## Environment Setup

### Step 1: Understanding Environment Variables

Environment variables are like secret settings for your app. Think of them as a config file that tells your app things like:
- How to connect to your database
- Your payment processing keys
- Your email service settings

### Step 2: Create Your Environment Files

You'll need different environment files for different stages:

#### 📝 Local Development (.env.local)
Create or update your `.env.local` file in your project root:

```bash
# Database
DATABASE_URL="mysql://username:password@localhost:3306/instacares_dev"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-here"

# Stripe Payment Processing
STRIPE_SECRET_KEY="sk_test_your_stripe_test_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"

# Email Service (Resend)
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="InstaCares <noreply@yourdomain.com>"

# Maps (Mapbox)
NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_mapbox_token"

# App Settings
NEXT_PUBLIC_BASE_URL="http://localhost:3005"
NODE_ENV="development"
ADMIN_SECRET_KEY="your-admin-secret"
PLATFORM_COMMISSION_RATE="0.15"
```

#### 🧪 Staging Environment (.env.staging)
For your test server:

```bash
# Database
DATABASE_URL="mysql://username:password@staging-server:3306/instacares_staging"

# Authentication
JWT_SECRET="different-secret-for-staging"

# Stripe (Test Mode)
STRIPE_SECRET_KEY="sk_test_your_stripe_test_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"

# Email Service
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="InstaCares Staging <staging@yourdomain.com>"

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_mapbox_token"

# App Settings
NEXT_PUBLIC_BASE_URL="https://staging.yourdomain.com"
NODE_ENV="staging"
ADMIN_SECRET_KEY="staging-admin-secret"
PLATFORM_COMMISSION_RATE="0.15"
```

#### 🌍 Production Environment (.env.production)
For your live server:

```bash
# Database
DATABASE_URL="mysql://username:password@production-server:3306/instacares"

# Authentication
JWT_SECRET="ultra-secure-production-jwt-secret"

# Stripe (Live Mode)
STRIPE_SECRET_KEY="sk_live_your_stripe_live_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_your_stripe_live_publishable_key"

# Email Service
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="InstaCares <noreply@instacares.com>"

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN="pk.your_mapbox_token"

# App Settings
NEXT_PUBLIC_BASE_URL="https://instacares.com"
NODE_ENV="production"
ADMIN_SECRET_KEY="super-secure-production-admin-key"
PLATFORM_COMMISSION_RATE="0.15"
PAYMENT_MODE="live"
STRIPE_CONNECT_ENABLED="true"
SKIP_ENV_VALIDATION="true"
```

### ⚠️ Important Security Notes:
- **Never commit these files to Git!** (They should be in your `.gitignore` file)
- **Use different secrets for each environment**
- **Make production secrets extra secure** (long, random strings)

---

## Local Testing

Before deploying anywhere, let's make sure everything works on your computer.

### Step 1: Install Dependencies
```bash
# Navigate to your project folder
cd path/to/your/instacares-project

# Install all required packages
npm install
```

### Step 2: Set Up Your Local Database
```bash
# Generate Prisma client (connects your app to database)
npx prisma generate

# Set up your database tables
npx prisma db push

# (Optional) Add sample data
npm run db:seed
```

### Step 3: Test Your Application
```bash
# Start the development server
npm run dev

# This will start your app at http://localhost:3005
```

### Step 4: Run Tests and Build
```bash
# Check for code errors
npm run lint

# Check TypeScript types
npm run type-check

# Build the production version
npm run build

# Test the production build
npm run start
```

### ✅ Local Testing Checklist:
- [ ] App starts without errors at http://localhost:3005
- [ ] You can create an account
- [ ] Database operations work (create/read/update/delete)
- [ ] File uploads work (if you have them)
- [ ] Payment processing works (in test mode)
- [ ] No console errors in browser developer tools

---

## Staging Deployment

Staging is like a dress rehearsal before the real performance. It's a copy of your live site where you can test everything without affecting real users.

### Step 1: Prepare Your Staging Server

#### If using a VPS (like DigitalOcean):
```bash
# Connect to your server
ssh your-username@your-staging-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
npm install -g pm2
```

#### If using Hostinger or similar shared hosting:
- Log into your hosting control panel
- Enable Node.js support
- Set Node.js version to 18 or higher

### Step 2: Set Up Environment Variables

On your staging server, create the environment file:
```bash
# Copy your staging environment variables to the server
# (Method varies by hosting provider)
```

### Step 3: Deploy to Staging
```bash
# From your local project folder:
npm run deploy:staging
```

This command will:
1. Build your application
2. Package it for deployment
3. Upload to your staging server
4. Install dependencies on the server
5. Set up the database
6. Start the application

### Step 4: Test Your Staging Site

Visit your staging URL and test:
- [ ] Site loads correctly
- [ ] All pages work
- [ ] User registration/login works
- [ ] Database operations work
- [ ] File uploads work (if any)
- [ ] Payment processing works (test mode)
- [ ] Email sending works

### 🔧 Common Staging Issues:
- **Site won't load**: Check server logs, ensure port 3000 is open
- **Database errors**: Verify DATABASE_URL is correct
- **Build errors**: Run `npm run build` locally first to catch issues
- **Permission errors**: Check file permissions on server

---

## Production Deployment

This is the big moment - making your app live for real users!

### Step 1: Final Pre-Deployment Checks

#### Security Checklist:
- [ ] All environment variables use production values
- [ ] Stripe is in live mode (not test mode)
- [ ] Strong, unique passwords and secrets
- [ ] Database is properly secured
- [ ] SSL certificate is installed (https://)
- [ ] Admin accounts have strong passwords

#### Performance Checklist:
- [ ] Images are optimized
- [ ] Application builds without warnings
- [ ] Database has proper indexes
- [ ] CDN is configured (if applicable)

### Step 2: Deploy to Production

#### Method 1: Using the Deployment Script (Recommended)
```bash
# Make sure all environment variables are set
export HOSTINGER_USER="your-hostinger-username"
export HOSTINGER_HOST="your-domain.com"
export HOSTINGER_PATH="/public_html"
export DATABASE_URL="your-production-database-url"
export JWT_SECRET="your-production-jwt-secret"
# ... set all other production environment variables

# Deploy to production
npm run deploy:production
```

#### Method 2: Manual Deployment
If the script doesn't work, here's the manual process:

```bash
# Step 1: Build locally
npm run build:prod

# Step 2: Create deployment package
tar -czf instacares-production.tar.gz \
  .next \
  public \
  prisma \
  package*.json \
  next.config.* \
  ecosystem.config.js \
  server.js \
  src

# Step 3: Upload to server
scp instacares-production.tar.gz user@your-server.com:/path/to/app/

# Step 4: Extract and setup on server
ssh user@your-server.com
cd /path/to/app
tar -xzf instacares-production.tar.gz
npm ci --production=false
npx prisma generate
npx prisma db push
pm2 start ecosystem.config.js
```

### Step 3: Verify Production Deployment

1. **Check if the app is running:**
```bash
# On your server:
pm2 list
# You should see "instacares" with status "online"
```

2. **Visit your live website:**
- Go to your domain (e.g., https://instacares.com)
- Test key functionality:
  - [ ] Homepage loads
  - [ ] User registration works
  - [ ] Login/logout works
  - [ ] Core features work (booking, payments, etc.)
  - [ ] Admin panel is accessible

3. **Monitor for errors:**
```bash
# Check application logs
pm2 logs instacares

# Check for any error messages
```

---

## Post-Deployment

Congratulations! Your app is live. But the work isn't over - here's what to do next:

### Step 1: Set Up Monitoring

#### Health Checks:
```bash
# Run the built-in health check
npm run health-check:prod

# This should return "OK" if everything is working
```

#### Set Up Automated Monitoring:
- **Uptime monitoring**: Use services like UptimeRobot (free)
- **Error tracking**: Consider Sentry for error monitoring
- **Performance monitoring**: Use built-in browser tools or third-party services

### Step 2: Set Up Backups

#### Database Backups:
```bash
# Create a backup script (save as backup-db.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u username -p database_name > backup_$DATE.sql
# Upload to cloud storage (AWS S3, Google Drive, etc.)
```

#### Application Backups:
```bash
# Your deployment script already creates backups, but you can also:
tar -czf app-backup-$(date +%Y%m%d).tar.gz /path/to/your/app
```

### Step 3: Set Up SSL Certificate (HTTPS)

Most hosting providers offer free SSL certificates:
- **Hostinger**: Enable SSL in control panel
- **Cloudflare**: Free SSL with their service
- **Let's Encrypt**: Free SSL certificates

### Step 4: Configure Domain and DNS

Make sure your domain points to your server:
1. Update DNS A record to point to your server IP
2. Update CNAME records if needed
3. Wait for DNS propagation (up to 24 hours)

---

## Troubleshooting

### Common Issues and Solutions

#### 🚨 Application Won't Start

**Symptoms:** PM2 shows app as "errored" or "stopped"

**Solutions:**
```bash
# Check the logs
pm2 logs instacares

# Common fixes:
# 1. Port already in use
pm2 kill
pm2 start ecosystem.config.js

# 2. Database connection issues
# Check your DATABASE_URL in .env.local

# 3. Missing dependencies
npm ci
npx prisma generate
```

#### 🚨 Database Connection Errors

**Symptoms:** "Can't connect to database" errors

**Solutions:**
1. **Check database credentials:**
   ```bash
   # Test database connection
   mysql -h hostname -u username -p database_name
   ```

2. **Verify DATABASE_URL format:**
   ```bash
   # Should look like:
   mysql://username:password@host:port/database_name
   ```

3. **Run database setup:**
   ```bash
   npx prisma db push
   ```

#### 🚨 Build Errors

**Symptoms:** `npm run build` fails

**Solutions:**
1. **Check TypeScript errors:**
   ```bash
   npm run type-check
   ```

2. **Check ESLint errors:**
   ```bash
   npm run lint
   ```

3. **Clean and reinstall:**
   ```bash
   npm run clean
   npm install
   ```

#### 🚨 File Permission Issues

**Symptoms:** "Permission denied" errors

**Solutions:**
```bash
# Fix file permissions
chmod -R 755 /path/to/your/app
chmod -R 644 /path/to/your/app/public
```

#### 🚨 Memory Issues

**Symptoms:** App crashes with "out of memory" errors

**Solutions:**
1. **Increase memory limit in PM2:**
   ```javascript
   // In ecosystem.config.js
   max_memory_restart: '1G'  // Increase from 500M
   ```

2. **Optimize your code:**
   - Check for memory leaks
   - Optimize image sizes
   - Use database pagination

#### 🚨 SSL/HTTPS Issues

**Symptoms:** "Not secure" warning or SSL errors

**Solutions:**
1. **Check SSL certificate:**
   ```bash
   openssl s_client -connect yourdomain.com:443
   ```

2. **Update environment variables:**
   ```bash
   NEXT_PUBLIC_BASE_URL="https://yourdomain.com"  # Note HTTPS
   ```

### Getting Help

When you're stuck, here's how to get help:

1. **Check the logs first:**
   ```bash
   pm2 logs instacares
   ```

2. **Search for error messages** on:
   - Stack Overflow
   - GitHub Issues
   - Next.js documentation

3. **Ask for help with specifics:**
   - Include error messages
   - Mention what you were doing when it broke
   - Share relevant configuration (without secrets!)

---

## Maintenance

Keeping your app running smoothly requires regular maintenance:

### Daily Tasks (Automated)
- [ ] Monitor server resources (CPU, memory, disk)
- [ ] Check for application errors
- [ ] Verify backups are working

### Weekly Tasks
- [ ] Review server logs
- [ ] Check website performance
- [ ] Test critical functionality
- [ ] Update dependencies (if needed)

### Monthly Tasks
- [ ] Security updates
- [ ] Performance optimization
- [ ] Database maintenance
- [ ] Backup testing

### Updating Your Application

When you make changes to your code:

1. **Test locally first:**
   ```bash
   npm run build
   npm run start
   ```

2. **Deploy to staging:**
   ```bash
   npm run deploy:staging
   ```

3. **Test on staging thoroughly**

4. **Deploy to production:**
   ```bash
   npm run deploy:production
   ```

### Rolling Back (If Something Goes Wrong)

Your deployment script creates automatic backups. To rollback:

```bash
# SSH to your server
ssh user@your-server.com

# Find the latest backup
cd /public_html/backups
ls -t backup_*.tar.gz

# Restore the backup
cd /public_html
pm2 stop instacares
tar -xzf backups/backup_YYYYMMDD_HHMMSS.tar.gz
pm2 start instacares
```

---

## Success! 🎉

If you've made it this far and your app is running live, congratulations! You've successfully deployed a full-stack Next.js application. 

Here's what you've accomplished:
- ✅ Set up a production environment
- ✅ Configured databases and external services
- ✅ Deployed to a live server
- ✅ Set up monitoring and backups
- ✅ Learned how to troubleshoot issues

### Next Steps
- Monitor your app's performance
- Gather user feedback
- Plan future features and improvements
- Keep learning and improving your deployment skills

### Resources for Continued Learning
- [Next.js Documentation](https://nextjs.org/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

## Quick Reference Commands

### Local Development
```bash
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Check code quality
npm run type-check            # Check TypeScript
```

### Database
```bash
npx prisma generate           # Generate Prisma client
npx prisma db push           # Update database schema
npx prisma studio            # Open database GUI
npm run db:seed              # Add sample data
```

### Deployment
```bash
npm run deploy:staging       # Deploy to staging
npm run deploy:production    # Deploy to production
npm run health-check         # Check app health
```

### Server Management (PM2)
```bash
pm2 list                     # Show running apps
pm2 logs instacares         # View app logs
pm2 restart instacares      # Restart app
pm2 stop instacares         # Stop app
pm2 start instacares        # Start app
```

---

*This guide was created to help beginners successfully deploy the InstaCares application. If you found it helpful or have suggestions for improvement, please let us know!*