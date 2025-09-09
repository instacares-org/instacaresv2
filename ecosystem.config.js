// PM2 Configuration for InstaCares
// This file configures PM2 process manager for production deployment

module.exports = {
  apps: [{
    name: 'instacares',
    script: 'server.js',  // Use our custom server with WebSocket support
    instances: 1,  // Single instance for Hostinger shared hosting
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    // Logging configuration
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Advanced PM2 features
    min_uptime: '10s',
    max_restarts: 10,
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Environment variables
    env_file: '.env.local'
  }],

  // Deployment configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      user: process.env.HOSTINGER_USER || 'hostinger_user',
      host: process.env.HOSTINGER_HOST || 'your-hostinger-host.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/instacares.git',
      path: process.env.HOSTINGER_PATH || '/public_html',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npm run build:prod && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p logs'
    }
  }
};