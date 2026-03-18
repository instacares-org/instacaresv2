module.exports = {
  apps: [
    {
      name: 'instacares',
      script: 'node_modules/.bin/next',
      args: 'start -p 3005',
      cwd: '/var/www/instacaresv2',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      // Logging
      error_file: '/var/www/instacaresv2/logs/pm2-error.log',
      out_file: '/var/www/instacaresv2/logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'socket-server',
      script: 'socket-server.js',
      cwd: '/var/www/instacaresv2',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
      kill_timeout: 5000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      error_file: '/var/www/instacaresv2/logs/socket-error.log',
      out_file: '/var/www/instacaresv2/logs/socket-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
