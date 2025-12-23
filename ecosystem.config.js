/**
 * PM2 Ecosystem Configuration
 * 
 * Production-ready configuration for the WhatsApp AI Bot
 * 
 * Usage:
 * - Start: pm2 start ecosystem.config.js
 * - Restart: pm2 restart whatsapp-bot
 * - Stop: pm2 stop whatsapp-bot
 * - Logs: pm2 logs whatsapp-bot
 * - Monitor: pm2 monit
 */

module.exports = {
  apps: [
    {
      name: "whatsapp-bot",
      script: "index.js",
      instances: 1, // Single instance due to WhatsApp session limitations
      exec_mode: "fork",
      watch: false, // Set to true for development
      
      // Restart policy
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true,
      restart_delay: 5000,
      
      // Memory management
      max_memory_restart: "500M",
      
      // Logging
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      // Environment variables
      env: {
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo"
      },
      
      env_development: {
        NODE_ENV: "development",
        DEBUG: "true",
        TZ: "America/Sao_Paulo"
      },
      
      env_production: {
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo"
      },
      
      // Process management
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,
      
      // Advanced features
      source_map_support: true,
      instance_var: "INSTANCE_ID",
      
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: "0 3 * * *",
      
      // Watch options (if watch is enabled)
      watch_options: {
        usePolling: true,
        interval: 1000,
        ignored: [
          "node_modules",
          "logs",
          ".git",
          ".wwebjs_auth",
          ".wwebjs_cache",
          "*.log"
        ]
      }
    }
  ],
  
  // Deploy configuration (optional)
  deploy: {
    production: {
      user: "node",
      host: "your-server.com",
      ref: "origin/main",
      repo: "git@github.com:saraivabr/aad-bot.git",
      path: "/var/www/whatsapp-bot",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
      env: {
        NODE_ENV: "production"
      }
    },
    development: {
      user: "node",
      host: "dev-server.com",
      ref: "origin/develop",
      repo: "git@github.com:saraivabr/aad-bot.git",
      path: "/var/www/whatsapp-bot-dev",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env development",
      env: {
        NODE_ENV: "development"
      }
    }
  }
};
