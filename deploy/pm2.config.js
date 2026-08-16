module.exports = {
  apps: [
    {
      name: 'proxima-backend',
      script: './backend/dist/index.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'proxima-frontend',
      script: './frontend/node_modules/next/dist/bin/next',
      args: 'start ./frontend -p 3000',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
