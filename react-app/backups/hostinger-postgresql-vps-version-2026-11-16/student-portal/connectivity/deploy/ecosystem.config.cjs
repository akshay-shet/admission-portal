// PM2 keeps the portal running and restarts it after a crash or a reboot.
//   cd /var/www/student-portal && pm2 start connectivity/deploy/ecosystem.config.cjs && pm2 save && pm2 startup
// One instance only (live updates and the sign-in limits live in this one process).
module.exports = {
  apps: [{
    name: 'student-portal',
    script: 'backend/server.js',
    cwd: __dirname + '/../..',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
  }],
};
