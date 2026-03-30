module.exports = {
  apps: [
    {
      name: "emlak-portal",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/root/konya-emlak-portal",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/emlak-portal/error.log",
      out_file: "/var/log/emlak-portal/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
