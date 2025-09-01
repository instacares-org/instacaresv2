---
name: Deployment Issue
about: Report a deployment-related issue
title: '[DEPLOY] '
labels: 'deployment, bug'
assignees: ''
---

## Deployment Issue Report

### Environment
- [ ] Local Development
- [ ] Staging
- [ ] Production (Hostinger)

### Deployment Method
- [ ] GitHub Actions (Automatic)
- [ ] Manual Script (`npm run deploy:staging` or `npm run deploy:production`)
- [ ] Manual SSH

### Issue Description
**What happened?**
A clear and concise description of the deployment issue.

**Expected behavior**
What should have happened during the deployment.

### Steps to Reproduce
1. 
2. 
3. 

### Error Messages
```
Paste any error messages here
```

### Environment Information
- Node.js version:
- npm version:
- Git commit hash:
- Deployment timestamp:

### Health Check Results
**Before deployment:**
```
npm run health-check
```

**After deployment:**
```
npm run health-check:prod
```

### Additional Context
- Recent changes made
- Any custom configurations
- Previous successful deployment timestamp

### Screenshots
If applicable, add screenshots of error messages or logs.

### Checklist
- [ ] Verified environment variables are set correctly
- [ ] Checked database connectivity  
- [ ] Reviewed application logs
- [ ] Attempted rollback if necessary
- [ ] Checked GitHub Actions logs (if applicable)