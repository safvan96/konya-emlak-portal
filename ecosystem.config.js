module.exports = {
  apps: [{
    name: 'emlak-portal',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: 'C:/Users/Administrator/konya-emlak-portal',
    env: {
      NODE_ENV: 'production',
    },
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
