# InstaCares Deployment Guide

This document outlines the deployment pipeline for the InstaCares Next.js application with the flow: local → staging (GitHub) → production (Hostinger).

## Overview

The deployment pipeline includes:
- **Local Development**: SQLite database, hot reloading
- **Staging Environment**: GitHub-hosted staging with test database
- **Production Environment**: Hostinger hosting with live database

## Prerequisites

### Local Development
- Node.js 20+
- npm or yarn
- Git

### GitHub Secrets (Required)
Add these secrets in your GitHub repository settings:

#### Hostinger Production Secrets
- `HOSTINGER_SSH_KEY` - Private SSH key for Hostinger server access
- `HOSTINGER_HOST` - Your Hostinger server hostname
- `HOSTINGER_USER` - SSH username for Hostinger
- `HOSTINGER_PATH` - Deployment path (e.g., `/public_html`)

#### Production Environment Variables
- `PROD_DATABASE_URL` - Production database connection string
- `PROD_JWT_SECRET` - Production JWT secret key
- `PROD_STRIPE_SECRET_KEY` - Live Stripe secret key
- `PROD_STRIPE_PUBLISHABLE_KEY` - Live Stripe publishable key
- `PROD_RESEND_API_KEY` - Production email service API key
- `PROD_MAPBOX_TOKEN` - Production Mapbox access token
- `PROD_BASE_URL` - Production base URL (e.g., https://instacares.com)
- `ADMIN_SECRET_KEY` - Production admin secret key

## Environment Configuration

### Local Development (.env.local)
```bash
NODE_ENV=development
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_BASE_URL="http://localhost:3005"
# ... other development variables
```

### Staging (.env.staging)
```bash
NODE_ENV=staging
DATABASE_URL="mysql://staging_user:password@staging-host:3306/instacares_staging"
NEXT_PUBLIC_BASE_URL="https://staging-instacares.yourdomain.com"
PAYMENT_MODE=test
# ... other staging variables
```

### Production (.env.production)
```bash
NODE_ENV=production
DATABASE_URL="mysql://prod_user:password@prod-host:3306/instacares_production"
NEXT_PUBLIC_BASE_URL="https://instacares.com"
PAYMENT_MODE=live
# ... other production variables
```

## Deployment Workflow

### Automatic Deployment

1. **Push to staging branch** triggers staging deployment
2. **Push to main branch** triggers production deployment

### Manual Deployment

#### Deploy to Staging
```bash
npm run deploy:staging
```

#### Deploy to Production
```bash
npm run deploy:production
```

## Scripts Reference

### Database Scripts
- `npm run setup:db:dev` - Setup development database
- `npm run setup:db:staging` - Setup staging database  
- `npm run setup:db:prod` - Setup production database
- `npm run db:push` - Push schema changes
- `npm run db:seed` - Seed database with test data

### Deployment Scripts
- `npm run deploy:staging` - Deploy to staging environment
- `npm run deploy:production` - Deploy to Hostinger production
- `npm run health-check` - Check application health
- `npm run health-check:prod` - Check production health

### Process Management (Production)
- `npm run pm2:start` - Start application with PM2
- `npm run pm2:stop` - Stop application
- `npm run pm2:restart` - Restart application
- `npm run pm2:status` - Check PM2 status
- `npm run pm2:logs` - View application logs

## GitHub Actions Pipeline

The CI/CD pipeline runs on:
- **Pull requests** to main/staging (tests only)
- **Push to staging branch** (deploy to staging)
- **Push to main branch** (deploy to production)

### Pipeline Stages

1. **Test** - Run linting, type checking, and tests
2. **Build** - Build application for target environment
3. **Deploy** - Deploy to target environment
4. **Health Check** - Verify deployment success
5. **Notify** - Send deployment notifications

## Hostinger Deployment

### Server Setup
1. Ensure SSH access is configured
2. Install Node.js 20+ on server
3. Install PM2 globally: `npm install -g pm2`
4. Create application directory
5. Set up database (MySQL recommended)

### First-time Setup
1. Clone repository to Hostinger
2. Install dependencies: `npm ci`
3. Copy environment file: `cp .env.production .env.local`
4. Setup database: `npm run setup:db:prod`
5. Build application: `npm run build:prod`
6. Start with PM2: `npm run pm2:start`

### Ongoing Deployments
The deployment script handles:
- Creating backups
- Stopping application
- Updating code
- Installing dependencies
- Running migrations
- Building application
- Restarting services
- Health checks

## Database Migrations

### Development
Uses `prisma db push` for rapid iteration

### Staging/Production
Uses proper migrations:
```bash
# Create migration
npx prisma migrate dev --name "description"

# Deploy migrations
npx prisma migrate deploy
```

## Monitoring and Health Checks

### Health Check Endpoint
```
GET /api/health
```

Returns application status including:
- Database connectivity
- Environment information
- Memory usage
- Service status

### Application Logs
- **Development**: Console output
- **Production**: PM2 logs in `/logs` directory
- **Access logs**: Via Hostinger control panel

## Troubleshooting

### Common Issues

#### Build Failures
- Check environment variables are set correctly
- Verify database connection
- Check for TypeScript/linting errors

#### Deployment Failures
- Verify SSH access to Hostinger
- Check server disk space
- Verify PM2 is installed
- Check database connectivity

#### Database Issues
- Verify connection string format
- Check database permissions
- Ensure schema is up to date

### Debug Commands
```bash
# Check build locally
npm run build:prod

# Test database connection
npm run setup:db:dev

# Check application health
npm run health-check

# View PM2 logs
npm run pm2:logs

# Check PM2 status
npm run pm2:status
```

## Security Considerations

1. **Environment Variables**: Never commit production secrets
2. **Database**: Use strong passwords and restrict access
3. **SSH Keys**: Use key-based authentication for deployments
4. **HTTPS**: Enable SSL/TLS in production
5. **Backups**: Regular database backups before deployments

## Rollback Procedure

If deployment fails:

1. **Automatic**: Script attempts rollback to previous version
2. **Manual**: SSH to server and restore from backup
3. **Database**: Restore from database backup if needed

```bash
# Manual rollback example
cd /public_html
tar -xzf backups/backup_YYYYMMDD_HHMMSS.tar.gz
npm run pm2:restart
```

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review application health endpoint
3. Check PM2 logs on server
4. Verify environment configuration
5. Test database connectivity