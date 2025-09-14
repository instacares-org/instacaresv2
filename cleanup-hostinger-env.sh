#!/bin/bash
# Hostinger Environment Files Cleanup Script
# Removes backup .env files, keeps only .env and .env.production

echo "🧹 Cleaning up Hostinger environment files..."
echo "============================================="

# Navigate to your project directory
cd ~/domains/instacares.net/public_html || cd /var/www/instacaresv2 || cd ~/instacares

echo "📍 Current directory: $(pwd)"

# List all .env files before cleanup
echo ""
echo "📋 Environment files found:"
ls -la .env* 2>/dev/null || echo "No .env files found"

# Create backup directory for safety
mkdir -p env-cleanup-backup-$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="env-cleanup-backup-$(date +%Y%m%d_%H%M%S)"

# Move backup files to backup directory
echo ""
echo "🗂️  Moving backup files to: $BACKUP_DIR"

# Count files being moved
backup_count=0

# Move various backup file patterns
for pattern in ".env.backup*" ".env.bak*" ".env.old*" ".env.save*" ".env.*backup*" ".env-*" ".env_*"; do
    if ls $pattern 2>/dev/null; then
        mv $pattern "$BACKUP_DIR/" 2>/dev/null && backup_count=$((backup_count + 1))
        echo "✅ Moved: $pattern"
    fi
done

# Handle numbered backups like .env.1, .env.2, etc.
for i in {1..20}; do
    if [ -f ".env.$i" ]; then
        mv ".env.$i" "$BACKUP_DIR/" 2>/dev/null && backup_count=$((backup_count + 1))
        echo "✅ Moved: .env.$i"
    fi
done

# Handle date-based backups
for file in .env.*-*-* .env.*_*_*; do
    if [ -f "$file" ] && [ "$file" != ".env" ] && [ "$file" != ".env.production" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && backup_count=$((backup_count + 1))
        echo "✅ Moved: $file"
    fi
done

echo ""
if [ $backup_count -gt 0 ]; then
    echo "📦 Moved $backup_count backup files to: $BACKUP_DIR"
else
    echo "✨ No backup files found to clean up"
    rmdir "$BACKUP_DIR" 2>/dev/null || true
fi

# Verify essential files exist
echo ""
echo "🔍 Verifying essential environment files:"

if [ -f ".env" ]; then
    echo "✅ .env - EXISTS"
    echo "   Size: $(wc -l < .env 2>/dev/null || echo '0') lines"
else
    echo "⚠️  .env - MISSING (this is needed for production)"
fi

if [ -f ".env.production" ]; then
    echo "✅ .env.production - EXISTS"
    echo "   Size: $(wc -l < .env.production 2>/dev/null || echo '0') lines"
else
    echo "💡 .env.production - NOT FOUND (optional, but recommended)"
fi

# Show current environment files
echo ""
echo "📂 Current environment files:"
ls -la .env* 2>/dev/null || echo "No .env files remaining"

# Verify critical environment variables
echo ""
echo "🔧 Checking critical environment variables in .env:"
if [ -f ".env" ]; then
    if grep -q "NEXTAUTH_SECRET=" .env; then
        echo "✅ NEXTAUTH_SECRET - SET"
    else
        echo "❌ NEXTAUTH_SECRET - MISSING"
    fi

    if grep -q "NEXTAUTH_URL=" .env; then
        echo "✅ NEXTAUTH_URL - SET"
        echo "   Value: $(grep 'NEXTAUTH_URL=' .env | head -1 | cut -d'=' -f2 | tr -d '"')"
    else
        echo "❌ NEXTAUTH_URL - MISSING"
    fi

    if grep -q "DATABASE_URL=" .env; then
        echo "✅ DATABASE_URL - SET"
    else
        echo "❌ DATABASE_URL - MISSING"
    fi
else
    echo "⚠️  Cannot check - .env file not found"
fi

echo ""
echo "🎉 Environment cleanup completed!"
echo "================================"
echo ""
echo "✅ Only essential .env files remain"
echo "✅ Backup files safely moved to: $BACKUP_DIR"
echo ""
echo "💡 Next steps:"
echo "   1. Verify your .env file has correct values"
echo "   2. Run the deployment script: ./hostinger-deployment.sh"
echo "   3. Test caregiver login at: https://instacares.net/login/caregiver"
echo ""
echo "📋 Cleanup completed at: $(date)"