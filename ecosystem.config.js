module.exports = {
  apps: [
    {
      name: "emlak-portal",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "C:/Users/Administrator/konya-emlak-portal",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
