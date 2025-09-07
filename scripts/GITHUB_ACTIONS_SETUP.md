# 🚀 GitHub Actions CI/CD Setup for Hostinger Deployment

This guide sets up a professional GitHub Actions workflow with version control that deploys directly to your Hostinger server through a web interface.

## 📋 Overview

Your new GitHub Actions workflow provides:

- ✅ **Automatic Version Control** - Auto-generates semantic versions
- ✅ **Manual Deployment Interface** - Deploy any version through GitHub UI
- ✅ **Build & Test Pipeline** - Validates code before deployment
- ✅ **Direct Hostinger Deployment** - SSH deployment to your server
- ✅ **Health Checks** - Verifies deployment success
- ✅ **Automatic Rollback** - Reverts to previous version on failure
- ✅ **Deployment History** - Track all deployments with versions
- ✅ **Environment Management** - Production/Staging environments

## 🔧 Setup Instructions

### Step 1: Configure GitHub Secrets

Go to your GitHub repository: https://github.com/instacares-org/instacaresv2/settings/secrets/actions

Add these secrets:

```
HOSTINGER_SSH_KEY    = Your SSH private key
HOSTINGER_HOST       = Your server IP or hostname
HOSTINGER_USER       = Your server username
HOSTINGER_PORT       = SSH port (usually 22)
```

#### How to get SSH Key:

```bash
# On your local machine, generate SSH key pair
ssh-keygen -t rsa -b 4096 -C "github-actions@instacares.com"

# This creates:
# ~/.ssh/id_rsa (private key - copy this to HOSTINGER_SSH_KEY)
# ~/.ssh/id_rsa.pub (public key - add to server)

# Copy public key to server
ssh-copy-id your-username@your-hostinger-server.com
```

### Step 2: Configure Environment Protection

1. Go to: https://github.com/instacares-org/instacaresv2/settings/environments
2. Create environment named `production`
3. Add protection rules:
   - ✅ Required reviewers (optional)
   - ✅ Wait timer: 0 minutes
   - ✅ Restrict to main branch

### Step 3: Test the Workflow

1. Push any change to main branch (automatic deployment)
2. Or use manual deployment through GitHub interface

## 🎛️ GitHub Actions Interface

### Automatic Deployment
- **Trigger**: Every push to `main` branch
- **Process**: Build → Test → Deploy → Verify
- **Version**: Auto-generated (e.g., v1.247.a3b4c5d)

### Manual Deployment Interface

Go to: https://github.com/instacares-org/instacaresv2/actions/workflows/production-deploy.yml

Click "Run workflow" and configure:

```yaml
🏷️ Version: v1.2.3          # Custom version or leave empty
🌍 Environment: production   # production or staging  
🔄 Force Deploy: false       # Bypass checks if needed
```

## 📊 Deployment Dashboard

### View Deployments
- **All Deployments**: https://github.com/instacares-org/instacaresv2/actions
- **Production History**: Filter by "production-deploy"
- **Version Tags**: https://github.com/instacares-org/instacaresv2/tags

### Deployment Status
Each deployment shows:
- ✅ Build Status
- 🚀 Deployment Status  
- 📊 Version Information
- 🔗 Live URL
- 📋 Commit Details
- ⏱️ Deployment Time

## 🎯 Version Control System

### Automatic Versioning
```
Format: v{MAJOR}.{MINOR}.{PATCH}
- MAJOR: 1 (fixed for now)
- MINOR: Commit count (auto-incremented)  
- PATCH: Git commit hash (unique identifier)

Example: v1.247.a3b4c5d
```

### Manual Versioning
```
Use semantic versioning:
- v1.0.0  - Initial release
- v1.1.0  - New features
- v1.1.1  - Bug fixes
- v2.0.0  - Breaking changes
```

### Version Management
- **Tags**: Automatic Git tags for each deployment
- **History**: Complete version history in GitHub
- **Rollback**: Deploy any previous version

## 🔄 Deployment Process

### 1. Build Phase
```yaml
📥 Checkout code
🏷️ Generate version
🔧 Setup Node.js
📦 Install dependencies  
🔍 Run tests
🏗️ Build application
```

### 2. Deploy Phase
```yaml
🔐 Setup SSH connection
📋 Prepare deployment info
💾 Create server backup
⏹️ Stop services
📥 Pull latest code
📦 Install dependencies
🏗️ Build on server
🗄️ Update database
▶️ Start services
🔍 Health check
```

### 3. Verification Phase
```yaml
✅ Check PM2 processes
📋 Verify application logs
💾 Check disk space
🌐 Test application response
```

## 🛠️ Advanced Features

### Environment Variables
Set in GitHub repository settings > Secrets:
```
NODE_ENV=production
DATABASE_URL=your-production-db
NEXT_PUBLIC_MAPBOX_TOKEN=your-token
JWT_SECRET=your-jwt-secret
```

### Deployment Strategies
```yaml
# Rolling deployment (zero downtime)
- Stop old processes
- Start new processes  
- Health check
- Rollback if failed

# Blue-Green deployment (future enhancement)
- Deploy to staging slot
- Switch traffic on success
- Keep previous version as backup
```

### Monitoring Integration
```yaml
# Post-deployment hooks
- Send Slack notification
- Update status page
- Trigger monitoring alerts
- Log deployment metrics
```

## 🚨 Troubleshooting

### Common Issues

#### SSH Connection Failed
```bash
# Check SSH key format
ssh-keygen -y -f ~/.ssh/id_rsa

# Test connection manually
ssh -i ~/.ssh/id_rsa user@server.com
```

#### Deployment Failed
```yaml
# Check GitHub Actions logs
# Look for specific error messages
# Verify server disk space
# Check PM2 process status
```

#### Version Conflicts
```bash
# Delete problematic tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

### Emergency Procedures

#### Manual Rollback
```bash
# SSH into server
ssh your-user@your-server.com

# Use backup restore
cd /var/www/instacares
sudo tar -xzf /var/backups/instacares/backup-YYYYMMDD-HHMMSS.tar.gz

# Restart services
pm2 restart all
```

#### Force Deployment
```yaml
# Use GitHub interface
# Set "Force Deploy" to true
# Bypasses update checks
# Useful for emergency fixes
```

## 📊 Monitoring & Metrics

### Deployment Metrics
- **Deployment Frequency**: Track via GitHub Actions history
- **Success Rate**: Monitor failed vs successful deployments  
- **Deployment Duration**: Average time from trigger to live
- **Rollback Frequency**: How often rollbacks are needed

### Application Metrics
- **Uptime**: Monitor after each deployment
- **Response Time**: Health check response times
- **Error Rates**: Monitor application logs
- **Resource Usage**: Server CPU/memory/disk

## 🎉 Benefits

### For Developers
- ✅ **No Server Access Needed** - Deploy from GitHub UI
- ✅ **Version Control** - Every deployment is versioned
- ✅ **Rollback Safety** - Easy revert to previous versions
- ✅ **Deployment History** - Complete audit trail
- ✅ **Automated Testing** - Code validation before deployment

### For Operations
- ✅ **Zero Downtime** - Rolling deployments
- ✅ **Automatic Backups** - Before every deployment
- ✅ **Health Monitoring** - Deployment verification
- ✅ **Error Recovery** - Automatic rollback on failure
- ✅ **Audit Compliance** - Complete deployment logs

---

## 🚀 Quick Start

1. **Add secrets to GitHub** (SSH key, server details)
2. **Push code to main** (triggers automatic deployment)  
3. **Monitor progress** in GitHub Actions tab
4. **Verify deployment** at https://instacares.net
5. **Use manual interface** for custom deployments

**Your professional CI/CD pipeline is ready! 🎊**