/** PM2 — ERP API on Hostinger VPS */
module.exports = {
  apps: [
    {
      name: "dhatterwal-erp-api",
      cwd: "/var/www/dhatterwal/server",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
      },
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
