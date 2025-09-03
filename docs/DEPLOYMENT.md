# InstaCares Deployment Guide

## Overview

InstaCares uses a three-stage deployment pipeline:
- **Local Development** → SQLite database, hot reloading
- **Staging** → GitHub-hosted test environment  
- **Production** → Hostinger hosting with live database

## Quick Start

### Prerequisites
- Node.js 20+ and npm
- Git repository setup
- Hostinger hosting account
- MySQL database (production)

### Environment Variables

Create `.env.local` for development:
```bash
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_BASE_URL="http://localhost:3005"
JWT_SECRET="your-dev-secret"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Production variables (set in Hostinger):
```bash
DATABASE_URL="mysql://user:pass@host/database"
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
JWT_SECRET="strong-production-secret"
# Add all production API keys
```

## Deployment Steps

### 1. Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### 2. Deploy to GitHub
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### 3. Deploy to Hostinger

#### Manual Deployment
```bash
# Build locally
npm run build

# Upload via FTP/SSH
- Upload all files except node_modules
- SSH into server
- Run: npm install --production
- Run: npm run start
```

#### Automated Deployment (GitHub Actions)
The `.github/workflows/deploy.yml` handles automatic deployment when you push to main branch.

Required GitHub Secrets:
- `HOSTINGER_SSH_KEY` - SSH private key
- `HOSTINGER_HOST` - Server hostname
- `HOSTINGER_USER` - SSH username
- `HOSTINGER_PATH` - Deployment path (e.g., `/public_html`)

### 4. Database Setup

#### Development (SQLite)
```bash
# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

#### Production (MySQL)
```bash
# Set production DATABASE_URL
# Run migrations
npx prisma migrate deploy
```

## Post-Deployment Checklist

- [ ] Test all pages load correctly
- [ ] Verify database connections
- [ ] Check payment processing (Stripe)
- [ ] Test email notifications
- [ ] Verify map functionality (Mapbox)
- [ ] Check mobile responsiveness
- [ ] Test user registration/login
- [ ] Monitor error logs

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Windows
netstat -ano | findstr :3005
taskkill /PID <process_id> /F
```

**Database Connection Failed**
- Check DATABASE_URL format
- Verify database credentials
- Ensure database server is running

**Build Errors**
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

**Environment Variables Not Loading**
- Ensure `.env.local` exists
- Restart the server after changes
- Check variable names match exactly

## Maintenance

### Regular Tasks
- Weekly: Check error logs
- Monthly: Update dependencies
- Quarterly: Security audit

### Backup Strategy
```bash
# Database backup
mysqldump -u user -p database > backup.sql

# Code backup
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

## Environment-Specific Commands

### Development
```bash
npm run dev          # Start dev server
npm run db:studio    # Open Prisma Studio
npm run lint         # Run linter
```

### Production
```bash
npm run build        # Build for production
npm run start        # Start production server
pm2 start            # Start with PM2
pm2 logs             # View logs
```

## Support

For deployment issues:
1. Check error logs first
2. Review this guide
3. Contact support with specific error messages

---

Last updated: January 2025