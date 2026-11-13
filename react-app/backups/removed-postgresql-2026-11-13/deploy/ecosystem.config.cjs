// pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup   (keeps the portal running and restarts it after a reboot)
module.exports = { apps: [{ name: 'student-portal', script: 'server/index.js', cwd: __dirname + '/..', instances: 1, autorestart: true, max_memory_restart: '400M', env: { NODE_ENV: 'production' } }] };
