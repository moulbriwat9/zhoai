module.exports = {
  apps: [{
    name: 'secure-chat-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }, {
    name: 'health-monitor',
    script: 'dist/monitoring/health-monitor.js',
    instances: 1,
    env: {
      NODE_ENV: 'production'
    },
    cron_restart: '0 4 * * *', // Restart daily at 4 AM
    autorestart: true,
    max_memory_restart: '500M'
  }]
};