#!/bin/bash

##############################################################################
# InstaCares Application Setup Script for Hostinger VPS
# Author: InstaCares Team
# Description: Complete setup script for Ubuntu/Debian VPS
# Usage: wget -O setup.sh https://raw.githubusercontent.com/instacares-org/instacaresv2/main/scripts/hostinger-setup.sh && chmod +x setup.sh && sudo ./setup.sh
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=""
EMAIL=""
DB_PASSWORD=""
JWT_SECRET=""
ADMIN_SECRET=""
REPOSITORY="https://github.com/instacares-org/instacaresv2.git"
APP_DIR="/var/www/instacares"
DB_NAME="instacares"
DB_USER="instacares"
NODE_VERSION="20"

# Logging
LOG_FILE="/var/log/instacares-setup.log"
exec > >(tee -a ${LOG_FILE})
exec 2>&1

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

##############################################################################
# User Input
##############################################################################

collect_user_input() {
    print_header "InstaCares Setup Configuration"
    
    echo "Please provide the following information:"
    echo ""
    
    read -p "Domain name (e.g., instacares.com): " DOMAIN
    while [[ -z "$DOMAIN" ]]; do
        print_error "Domain name is required!"
        read -p "Domain name (e.g., instacares.com): " DOMAIN
    done
    
    read -p "Your email address (for SSL certificate): " EMAIL
    while [[ -z "$EMAIL" ]]; do
        print_error "Email address is required!"
        read -p "Your email address: " EMAIL
    done
    
    read -p "MySQL root password (leave empty to generate): " DB_PASSWORD
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(generate_password)
        print_info "Generated MySQL password: $DB_PASSWORD"
    fi
    
    read -p "JWT Secret (leave empty to generate): " JWT_SECRET
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(generate_password)
        print_info "Generated JWT secret: $JWT_SECRET"
    fi
    
    read -p "Admin Secret Key (leave empty to generate): " ADMIN_SECRET
    if [[ -z "$ADMIN_SECRET" ]]; then
        ADMIN_SECRET=$(generate_password)
        print_info "Generated Admin secret: $ADMIN_SECRET"
    fi
    
    echo ""
    print_warning "Please save these credentials in a secure location!"
    echo "MySQL Root Password: $DB_PASSWORD"
    echo "JWT Secret: $JWT_SECRET"
    echo "Admin Secret: $ADMIN_SECRET"
    echo ""
    
    read -p "Press Enter to continue..."
}

##############################################################################
# System Setup
##############################################################################

update_system() {
    print_header "Updating System Packages"
    
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    print_success "System updated successfully"
}

install_nodejs() {
    print_header "Installing Node.js $NODE_VERSION"
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    print_success "Node.js installed: $node_version"
    print_success "NPM installed: $npm_version"
    
    # Install global packages
    npm install -g pm2 @prisma/cli
    print_success "PM2 and Prisma CLI installed globally"
}

install_mysql() {
    print_header "Installing MySQL Server"
    
    # Set MySQL root password before installation
    debconf-set-selections <<< "mysql-server mysql-server/root_password password $DB_PASSWORD"
    debconf-set-selections <<< "mysql-server mysql-server/root_password_again password $DB_PASSWORD"
    
    apt install -y mysql-server mysql-client
    
    # Secure MySQL installation
    mysql -u root -p"$DB_PASSWORD" -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"
    mysql -u root -p"$DB_PASSWORD" -e "DELETE FROM mysql.user WHERE User='';"
    mysql -u root -p"$DB_PASSWORD" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
    mysql -u root -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS test;"
    mysql -u root -p"$DB_PASSWORD" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
    mysql -u root -p"$DB_PASSWORD" -e "FLUSH PRIVILEGES;"
    
    # Create database and user for InstaCares
    mysql -u root -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u root -p"$DB_PASSWORD" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
    mysql -u root -p"$DB_PASSWORD" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    mysql -u root -p"$DB_PASSWORD" -e "FLUSH PRIVILEGES;"
    
    # Enable and start MySQL
    systemctl enable mysql
    systemctl start mysql
    
    print_success "MySQL installed and configured"
}

install_nginx() {
    print_header "Installing Nginx"
    
    apt install -y nginx
    
    # Enable and start Nginx
    systemctl enable nginx
    systemctl start nginx
    
    print_success "Nginx installed and started"
}

##############################################################################
# Application Setup
##############################################################################

clone_repository() {
    print_header "Cloning InstaCares Repository"
    
    # Remove existing directory if it exists
    rm -rf $APP_DIR
    
    # Clone the repository
    git clone $REPOSITORY $APP_DIR
    cd $APP_DIR
    
    print_success "Repository cloned to $APP_DIR"
}

setup_application() {
    print_header "Setting up InstaCares Application"
    
    cd $APP_DIR
    
    # Install dependencies
    print_info "Installing Node.js dependencies..."
    npm ci --production
    
    # Create environment file
    print_info "Creating environment configuration..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL="mysql://$DB_USER:$DB_PASSWORD@localhost:3306/$DB_NAME"

# JWT Configuration
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"

# Stripe Configuration (Demo mode - update with real keys for production)
STRIPE_SECRET_KEY="sk_test_demo_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_demo_key"
STRIPE_WEBHOOK_SECRET="whsec_demo_webhook"

# Stripe Connect Configuration
STRIPE_CONNECT_ENABLED="false"
PLATFORM_COMMISSION_RATE="0.15"

# Payment Mode Configuration
PAYMENT_MODE="demo"

# Mapbox Configuration (Update with real token)
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1IjoiZmFyYWR5MDAxIiwiYSI6ImNtZWVpd3MycjBqMTYybXByNTAweTBsenUifQ.7GvBthq5x1TY3O_di67zJQ"

# Base URL
NEXT_PUBLIC_BASE_URL="https://$DOMAIN"

# Email Configuration (Update with real API key)
RESEND_API_KEY="your_resend_api_key_here"
EMAIL_FROM="InstaCares <noreply@$DOMAIN>"

# SMS Configuration (Update with real credentials)
TWILIO_ACCOUNT_SID="your_twilio_account_sid_here"
TWILIO_AUTH_TOKEN="your_twilio_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"

# Admin Configuration
ADMIN_SECRET_KEY="$ADMIN_SECRET"

# Environment
NODE_ENV="production"
EOF
    
    # Set proper ownership and permissions
    chown -R www-data:www-data $APP_DIR
    chmod -R 755 $APP_DIR
    chmod 600 $APP_DIR/.env
    
    print_success "Environment configuration created"
}

setup_database() {
    print_header "Setting up Database"
    
    cd $APP_DIR
    
    # Generate Prisma client
    print_info "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    print_info "Running database migrations..."
    npx prisma db push --force-reset
    
    # Seed database if seed file exists
    if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
        print_info "Seeding database..."
        npx prisma db seed || print_warning "Database seeding failed - continuing anyway"
    fi
    
    print_success "Database setup completed"
}

build_application() {
    print_header "Building Application"
    
    cd $APP_DIR
    
    # Build the Next.js application
    print_info "Building Next.js application..."
    npm run build:prod
    
    print_success "Application built successfully"
}

##############################################################################
# Service Configuration
##############################################################################

setup_pm2() {
    print_header "Setting up PM2 Process Manager"
    
    cd $APP_DIR
    
    # Create PM2 ecosystem file if it doesn't exist
    if [ ! -f "ecosystem.config.js" ]; then
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'instacares',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
}
EOF
    fi
    
    # Create logs directory
    mkdir -p logs
    chown -R www-data:www-data logs
    
    # Start application with PM2
    print_info "Starting application with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    print_success "PM2 configured and application started"
}

configure_nginx() {
    print_header "Configuring Nginx Reverse Proxy"
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/instacares << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # File upload size limit
    client_max_body_size 50M;
    
    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Socket.io support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable the site
    ln -sf /etc/nginx/sites-available/instacares /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configured successfully"
}

##############################################################################
# Security Configuration
##############################################################################

configure_firewall() {
    print_header "Configuring UFW Firewall"
    
    # Install and configure UFW
    apt install -y ufw
    
    # Reset firewall rules
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out!)
    ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    print_success "Firewall configured"
    print_warning "SSH access is allowed on port 22 - make sure to secure it!"
}

setup_ssl() {
    print_header "Setting up SSL Certificate with Let's Encrypt"
    
    read -p "Would you like to set up SSL with Let's Encrypt? (y/n): " setup_ssl_choice
    
    if [[ $setup_ssl_choice =~ ^[Yy]$ ]]; then
        # Install Certbot
        apt install -y snapd
        snap install --classic certbot
        ln -sf /snap/bin/certbot /usr/bin/certbot
        
        # Obtain SSL certificate
        print_info "Obtaining SSL certificate for $DOMAIN..."
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect
        
        # Set up automatic renewal
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        print_success "SSL certificate installed and auto-renewal configured"
    else
        print_info "Skipping SSL setup - you can run 'certbot --nginx' later"
    fi
}

##############################################################################
# Final Setup and Verification
##############################################################################

create_admin_user() {
    print_header "Creating Admin User"
    
    cd $APP_DIR
    
    print_info "You can create an admin user by visiting: https://$DOMAIN/admin"
    print_info "Use the admin secret key: $ADMIN_SECRET"
    
    # Create a simple admin creation script
    cat > create-admin.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  
  if (!email || !password) {
    console.log('Usage: node create-admin.js <email> <password>');
    process.exit(1);
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        phoneNumber: '+1234567890',
        role: 'ADMIN',
        emailVerified: true
      }
    });
    
    console.log('Admin user created successfully:', admin.email);
  } catch (error) {
    console.error('Error creating admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
EOF
    
    print_success "Admin creation script ready"
    print_info "To create an admin user manually, run: node create-admin.js admin@$DOMAIN your_password"
}

display_summary() {
    print_header "Installation Summary"
    
    echo "🎉 InstaCares application has been successfully installed!"
    echo ""
    echo "📋 Installation Details:"
    echo "├── Domain: https://$DOMAIN"
    echo "├── Application Directory: $APP_DIR"
    echo "├── Database: MySQL ($DB_NAME)"
    echo "├── Process Manager: PM2"
    echo "├── Web Server: Nginx"
    echo "└── SSL: Let's Encrypt (if configured)"
    echo ""
    echo "🔐 Important Credentials (SAVE THESE!):"
    echo "├── MySQL Root Password: $DB_PASSWORD"
    echo "├── JWT Secret: $JWT_SECRET"
    echo "└── Admin Secret Key: $ADMIN_SECRET"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Visit https://$DOMAIN to verify the application is running"
    echo "2. Update API keys in $APP_DIR/.env for:"
    echo "   - Stripe (payment processing)"
    echo "   - Mapbox (location services)"
    echo "   - Resend (email notifications)"
    echo "   - Twilio (SMS notifications)"
    echo "3. Create admin user: node $APP_DIR/create-admin.js admin@$DOMAIN password"
    echo ""
    echo "📖 Useful Commands:"
    echo "├── Check application status: pm2 status"
    echo "├── View application logs: pm2 logs instacares"
    echo "├── Restart application: pm2 restart instacares"
    echo "├── Check Nginx status: systemctl status nginx"
    echo "└── SSL certificate renewal: certbot renew"
    echo ""
    echo "📝 Configuration files:"
    echo "├── Environment: $APP_DIR/.env"
    echo "├── PM2 Config: $APP_DIR/ecosystem.config.js"
    echo "├── Nginx Config: /etc/nginx/sites-available/instacares"
    echo "└── Setup Log: $LOG_FILE"
    echo ""
    print_success "Setup completed successfully!"
}

##############################################################################
# Error Handling
##############################################################################

cleanup_on_error() {
    print_error "An error occurred during installation!"
    print_info "Check the log file: $LOG_FILE"
    print_info "You can re-run this script to retry the installation."
    exit 1
}

# Set error trap
trap cleanup_on_error ERR

##############################################################################
# Main Installation Flow
##############################################################################

main() {
    print_header "InstaCares Application Setup for Hostinger VPS"
    print_info "This script will install and configure the complete InstaCares application"
    print_warning "Make sure you have root access and a stable internet connection"
    echo ""
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Collect user input
    collect_user_input
    
    # System setup
    update_system
    install_nodejs
    install_mysql
    install_nginx
    
    # Application setup
    clone_repository
    setup_application
    setup_database
    build_application
    
    # Service configuration
    setup_pm2
    configure_nginx
    
    # Security
    configure_firewall
    setup_ssl
    
    # Final setup
    create_admin_user
    display_summary
    
    print_success "🎉 InstaCares installation completed successfully!"
}

# Run main function
main "$@"