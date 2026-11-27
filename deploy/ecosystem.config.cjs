// pm2 process definition for the CMS: keeps `next start` running on port 3001
// and restarts it on crash. The website runs separately on port 3000.
module.exports = {
  apps: [
    {
      name: "vionsys-cms",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      instances: 1,
      max_memory_restart: "1000M",
      time: true,
    },
  ],
};
