module.exports = {
  apps: [
    {
      name: 'emlak-portal',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: 'C:/Users/Administrator/konya-emlak-portal',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      // Hepsiemlak ilçe bazlı scraper — günde 1 kez (12:00)
      // Chrome debug port 9222 gerektirir
      name: 'hepsiemlak-cron',
      script: 'scripts/hepsiemlak-ilceler.js',
      cwd: 'C:/Users/Administrator/konya-emlak-portal',
      cron_restart: '0 12 * * *',
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ]
};
