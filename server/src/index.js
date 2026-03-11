const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { PORT } = require('./config/constants');
const db = require('./config/db'); // Initialize DB
const { sendResponse } = require('./utils/response');
const { createRequestLogger } = require('./middleware/request-logger');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const archiveRoutes = require('./routes/archive');
const thumbnailRoutes = require('./routes/thumbnail');
const searchRoutes = require('./routes/search');
const mountRoutes = require('./routes/mounts');
const settingsRoutes = require('./routes/settings');
const favoriteRoutes = require('./routes/favorites');
const taskManagerRoutes = require('./routes/task-manager');
const appDataRoutes = require('./routes/app-data');
const shareRoutes = require('./routes/shares');
const publicRoutes = require('./routes/public');
const terminalRoutes = require('./routes/terminal');
const logsRoutes = require('./routes/logs');
const siteRoutes = require('./routes/site');
const downloaderRoutes = require('./routes/downloader');
const appStoreRoutes = require('./routes/app-store');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  app.use(createRequestLogger({ db }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api', fileRoutes);
  app.use('/api/archive', archiveRoutes);
  app.use('/api/thumbnail', thumbnailRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/mounts', mountRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/task-manager', taskManagerRoutes);
  app.use('/api/app-data', appDataRoutes);
  app.use('/api/shares', shareRoutes);
  app.use('/api/terminal', terminalRoutes);
  app.use('/api/downloader', downloaderRoutes);
  app.use('/api/app-store', appStoreRoutes);
  app.use('/s', publicRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api', siteRoutes);

  const prodPublic = path.join(__dirname, 'public');
  const devPublic = path.join(__dirname, '../public');
  
  const finalPublicDir = fs.existsSync(prodPublic) ? prodPublic : devPublic;
  
  if (fs.existsSync(finalPublicDir)) {
    console.log(`Frontend detected, serving static files from ${finalPublicDir}`);
    app.use(express.static(finalPublicDir));

    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(finalPublicDir, 'index.html'));
    });
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/s')) {
      return sendResponse(res, false, 'Not Found');
    }
    next();
  });

  app.use((err, req, res, _next) => {
    res.locals.__reqLogError = err?.stack || err?.message || String(err);
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      return sendResponse(res, false, 'Payload too large', null, 413);
    }
    console.error(err.stack);
    sendResponse(res, false, 'Internal Server Error');
  });

  return app;
}

function startServer(port = PORT) {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  return { app, server };
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };
