#!/bin/bash

##############################################################################
# InstaCares Auto-Deploy Script for Hostinger VPS
# Author: InstaCares Team
# Description: Automated deployment script that pulls latest code and deploys
# Usage: ./auto-deploy-hostinger.sh [--force] [--restart-only] [--backup]
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="instacares"
APP_DIR="/var/www/instacares"
BACKUP_DIR="/var/backups/instacares"
LOG_FILE="/var/log/instacares-deploy.log"
REPOSITORY="https://github.com/instacares-org/instacaresv2.git"
BRANCH="main"
NODE_VERSION="20"

# Parse command line arguments
FORCE_DEPLOY=false
RESTART_ONLY=false
CREATE_BACKUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    --restart-only)
      RESTART_ONLY=true
      shift
      ;;
    --backup)
      CREATE_BACKUP=true
      shift
      ;;
    *)
      echo "Unknown option $1"
      echo "Usage: $0 [--force] [--restart-only] [--backup]"
      exit 1
      ;;
  esac
done

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using a dedicated user for security."
    fi
}

# Create backup function
create_backup() {
    if [[ "$CREATE_BACKUP" == true ]] && [[ -d "$APP_DIR" ]]; then
        log "Creating backup..."
        
        # Create backup directory if it doesn't exist
        sudo mkdir -p "$BACKUP_DIR"
        
        # Create timestamped backup
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        sudo tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$APP_DIR" . 2>/dev/null || true
        
        log "Backup created: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
        
        # Keep only last 5 backups
        cd "$BACKUP_DIR"
        sudo ls -t backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r sudo rm --
    fi
}

# Check if changes are available
check_for_updates() {
    if [[ "$FORCE_DEPLOY" == true ]]; then
        log "Force deploy requested, skipping update check"
        return 0
    fi
    
    cd "$APP_DIR"
    
    # Fetch latest changes
    git fetch origin "$BRANCH" 2>/dev/null || error "Failed to fetch from repository"
    
    # Check if there are new commits
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/$BRANCH)
    
    if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
        info "No updates available. Current commit: ${LOCAL_COMMIT:0:7}"
        if [[ "$RESTART_ONLY" == true ]]; then
            log "Restart-only mode requested, proceeding with restart..."
            return 0
        else
            log "Application is up to date. Exiting."
            exit 0
        fi
    else
        log "Updates available. Local: ${LOCAL_COMMIT:0:7} → Remote: ${REMOTE_COMMIT:0:7}"
        return 0
    fi
}

# Pull latest code
pull_latest_code() {
    if [[ "$RESTART_ONLY" == true ]]; then
        log "Restart-only mode, skipping code pull"
        return 0
    fi
    
    log "Pulling latest code from $BRANCH branch..."
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash push -m "Auto-deploy stash $(date)" 2>/dev/null || true
    
    # Pull latest changes
    git pull origin "$BRANCH" || error "Failed to pull latest code"
    
    # Get the latest commit info
    COMMIT_INFO=$(git log -1 --pretty=format:"%h - %s (%cr) <%an>")
    log "Deployed commit: $COMMIT_INFO"
}

# Install/Update dependencies
install_dependencies() {
    if [[ "$RESTART_ONLY" == true ]]; then
        log "Restart-only mode, skipping dependency installation"
        return 0
    fi
    
    log "Installing/updating dependencies..."
    cd "$APP_DIR"
    
    # Check if package.json has changed
    if git diff HEAD~1 HEAD --name-only | grep -q "package.*\.json"; then
        log "Package files changed, running clean install..."
        rm -rf node_modules package-lock.json 2>/dev/null || true
        npm ci || error "Failed to install dependencies"
    else
        log "No package changes detected, running quick install..."
        npm ci || error "Failed to install dependencies"
    fi
}

# Build the application
build_application() {
    if [[ "$RESTART_ONLY" == true ]]; then
        log "Restart-only mode, skipping build"
        return 0
    fi
    
    log "Building application..."
    cd "$APP_DIR"
    
    # Set production environment
    export NODE_ENV=production
    export SKIP_ENV_VALIDATION=true
    
    # Clean previous build
    rm -rf .next 2>/dev/null || true
    
    # Generate Prisma client
    npx prisma generate || error "Failed to generate Prisma client"
    
    # Build Next.js application
    npm run build || error "Failed to build application"
    
    log "Application built successfully"
}

# Update database schema (if needed)
update_database() {
    if [[ "$RESTART_ONLY" == true ]]; then
        log "Restart-only mode, skipping database update"
        return 0
    fi
    
    log "Checking database schema..."
    cd "$APP_DIR"
    
    # Check if schema has changed
    if git diff HEAD~1 HEAD --name-only | grep -q "prisma/schema.prisma"; then
        warning "Database schema changed, applying migrations..."
        
        # Create database backup before migration
        if [[ -f "prisma/dev.db" ]]; then
            cp prisma/dev.db "prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)" || true
        fi
        
        # Apply database migrations
        npx prisma db push --accept-data-loss || warning "Database migration failed, continuing..."
        
        log "Database schema updated"
    else
        log "No database schema changes detected"
    fi
}

# Restart application with PM2
restart_application() {
    log "Restarting application with PM2..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        warning "PM2 not found, installing..."
        npm install -g pm2 || error "Failed to install PM2"
    fi
    
    cd "$APP_DIR"
    
    # Stop existing processes
    pm2 delete "$APP_NAME" 2>/dev/null || true
    pm2 delete "instacares-websocket" 2>/dev/null || true
    
    # Start main application
    pm2 start ecosystem.config.js --env production || error "Failed to start main application"
    
    # Start WebSocket server
    pm2 start server.js --name "instacares-websocket" -- --port 3007 || warning "Failed to start WebSocket server"
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami)) 2>/dev/null || true
    
    log "Application restarted successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check if main application is running
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log "✅ Main application is running"
    else
        error "❌ Main application failed to start"
    fi
    
    # Check if WebSocket server is running
    if pm2 list | grep -q "instacares-websocket.*online"; then
        log "✅ WebSocket server is running"
    else
        warning "⚠️ WebSocket server may not be running"
    fi
    
    # Test HTTP response (if accessible)
    if command -v curl &> /dev/null; then
        if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log "✅ Application responding to HTTP requests"
        else
            warning "⚠️ Application may not be responding to HTTP requests"
        fi
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    cd "$APP_DIR"
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    # Clean old log files
    find /var/log -name "*instacares*" -type f -mtime +30 -delete 2>/dev/null || true
    
    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f -mtime +7 -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Display deployment summary
display_summary() {
    log "🚀 Deployment Summary"
    echo -e "${CYAN}================================${NC}"
    echo -e "${GREEN}✅ Deployment completed successfully${NC}"
    echo -e "${BLUE}📅 Date: $(date)${NC}"
    
    if [[ "$RESTART_ONLY" != true ]]; then
        cd "$APP_DIR"
        COMMIT_INFO=$(git log -1 --pretty=format:"%h - %s")
        echo -e "${PURPLE}📝 Deployed: $COMMIT_INFO${NC}"
    fi
    
    echo -e "${YELLOW}🔧 Application Status:${NC}"
    pm2 list | grep -E "(instacares|Process)" || true
    echo -e "${CYAN}================================${NC}"
    
    log "View logs with: pm2 logs $APP_NAME"
    log "Monitor with: pm2 monit"
    log "Deployment log: $LOG_FILE"
}

# Main deployment function
main() {
    log "🚀 Starting InstaCares Auto-Deployment"
    log "Arguments: $*"
    
    # Initial checks
    check_permissions
    
    # Create directories if they don't exist
    sudo mkdir -p "$BACKUP_DIR"
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo touch "$LOG_FILE"
    sudo chmod 666 "$LOG_FILE" 2>/dev/null || true
    
    # Check if application directory exists
    if [[ ! -d "$APP_DIR" ]]; then
        error "Application directory not found: $APP_DIR"
    fi
    
    # Create backup if requested
    create_backup
    
    # Check for updates
    check_for_updates
    
    # Deployment steps
    pull_latest_code
    install_dependencies
    build_application
    update_database
    restart_application
    health_check
    cleanup
    display_summary
    
    log "🎉 Auto-deployment completed successfully!"
}

# Error handling
trap 'error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"