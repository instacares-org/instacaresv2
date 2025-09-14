# Deployment Safeguards for InstaCares

## Critical Files - NEVER Commit to GitHub

### Environment Files
- `.env`
- `.env.local`
- `.env.production`
- `.env.production.local`
- `.env.development`
- `.env.development.local`

These files contain sensitive information like:
- Database credentials
- API keys
- JWT secrets
- Stripe keys
- Admin passwords

## Deployment Pipeline Protection

### Current Safeguards in Place:

1. **`.gitignore` Protection**
   - All `.env*` files are excluded from Git
   - Development database files excluded
   - Temporary files and logs excluded

2. **Deployment Script Protection** (`scripts/deploy-hostinger.sh`)
   - Uses `rsync --exclude=.env*` to prevent copying local env files
   - Creates production env file separately on server
   - Maintains backups before deployment
   - Automatic rollback on failure

3. **Production Environment Isolation**
   - Production uses its own `.env.local` file
   - Database URL points to production database
   - Environment variables set on server, not in code

## Safe Deployment Workflow

### From Local to GitHub:
```bash
# Before committing, always check:
git status  # Ensure no .env files are staged
git diff    # Review changes

# Safe commit
git add -A  # .gitignore will exclude sensitive files
git commit -m "Your message"
git push origin main
```

### From GitHub to Production:
```bash
# The deployment script safely:
1. Excludes all .env files during rsync
2. Creates production .env.local on server
3. Never overwrites production environment
```

## Emergency Procedures

### If .env File Accidentally Committed:
1. **Immediately rotate all secrets**
2. Remove from Git history:
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env*" \
  --prune-empty --tag-name-filter cat -- --all
git push --force --all
```

### If Production Environment Corrupted:
1. SSH to production server
2. Check backup: `ls /public_html/backups/`
3. Restore: `tar -xzf /public_html/backups/backup_[latest].tar.gz`
4. Restart: `pm2 restart instacares`

## Additional Safety Measures

### Pre-deployment Checklist:
- [ ] No sensitive data in code
- [ ] All env variables use process.env
- [ ] Database migrations tested locally
- [ ] Build succeeds locally
- [ ] No console.log of sensitive data

### Post-deployment Verification:
- [ ] Application running (`pm2 status`)
- [ ] Database connected
- [ ] Environment is production (`NODE_ENV=production`)
- [ ] No error logs (`pm2 logs instacares --err`)

## Contact for Issues
If deployment issues occur:
1. Check PM2 logs: `pm2 logs instacares`
2. Check nginx logs: `/var/log/nginx/error.log`
3. Verify environment: `pm2 env instacares`

## Never Do This:
- ❌ Copy .env.production to GitHub
- ❌ Hardcode secrets in code
- ❌ Use production database locally
- ❌ Skip backup before deployment
- ❌ Force push to main branch
- ❌ Deploy without testing build

## Always Do This:
- ✅ Keep .env files local only
- ✅ Use environment variables
- ✅ Test with development database
- ✅ Create backups before deploy
- ✅ Review changes before commit
- ✅ Verify deployment success