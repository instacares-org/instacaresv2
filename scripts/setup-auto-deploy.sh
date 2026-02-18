#!/bin/bash

##############################################################################
# InstaCares Auto-Deploy Setup Script
# Author: InstaCares Team  
# Description: Sets up automated deployment on Hostinger server
# Usage: Run this once on your server to set up automation
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/var/www/instacares"
SCRIPTS_DIR="$APP_DIR/scripts"

echo -e "${BLUE}🚀 Setting up InstaCares Auto-Deployment${NC}"

# Check if running on server
if [[ ! -d "$APP_DIR" ]]; then
    echo -e "${RED}❌ Application directory not found: $APP_DIR${NC}"
    echo "Please run this script on your Hostinger server after initial deployment"
    exit 1
fi

# Make deployment script executable
echo -e "${YELLOW}📝 Making deployment scripts executable...${NC}"
chmod +x "$SCRIPTS_DIR/auto-deploy-hostinger.sh"
chmod +x "$SCRIPTS_DIR/setup-auto-deploy.sh"

# Create symbolic link in /usr/local/bin for easy access
echo -e "${YELLOW}🔗 Creating system-wide command...${NC}"
sudo ln -sf "$SCRIPTS_DIR/auto-deploy-hostinger.sh" /usr/local/bin/instacares-deploy

echo -e "${YELLOW}📋 Creating deployment alias...${NC}"
echo "alias deploy='instacares-deploy'" >> ~/.bashrc

echo -e "${GREEN}✅ Setup completed!${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Auto-deployment is now set up!${NC}"
echo ""
echo -e "${YELLOW}📖 Usage Options:${NC}"
echo ""
echo -e "${GREEN}1. Manual Deployment (SSH into server):${NC}"
echo "   instacares-deploy                 # Deploy latest changes"
echo "   instacares-deploy --force         # Force deploy even if no changes"
echo "   instacares-deploy --restart-only  # Just restart without pulling code"
echo "   instacares-deploy --backup        # Create backup before deploying"
echo ""
echo -e "${GREEN}2. Quick Deploy Alias:${NC}"
echo "   deploy                           # Same as instacares-deploy"
echo ""
echo -e "${GREEN}3. Set up Cron Job (auto-deploy every 5 minutes):${NC}"
echo "   echo '*/5 * * * * /usr/local/bin/instacares-deploy' | crontab -"
echo ""
echo -e "${GREEN}4. Set up GitHub Webhook:${NC}"
echo "   - Upload webhook-deploy.php to your public_html directory"
echo "   - Set webhook URL: https://yourdomain.com/webhook-deploy.php"
echo "   - Configure secret in GitHub webhook settings"
echo ""
echo -e "${GREEN}5. Check Status:${NC}"
echo "   pm2 list                         # Show running processes"
echo "   pm2 logs instacares             # View application logs"
echo "   pm2 monit                       # Monitor applications"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"