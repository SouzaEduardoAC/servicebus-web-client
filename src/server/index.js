import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, port } from './config.js';
import { httpLogger, helmetMiddleware, corsMiddleware, apiKeyMiddleware } from './middleware.js';
import { apiRouter } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(httpLogger);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json());

// Serve static files from the Vue app build directory
app.use(express.static(path.join(__dirname, '../../dist')));

app.use('/api', apiKeyMiddleware, apiRouter);

// Handle SPA routing: send index.html for any other requests that don't match API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

const server = app.listen(port, () => {
  logger.info(`Backend server listening on http://localhost:${port}`);
});

const gracefulShutdown = () => {
  logger.info('Starting graceful shutdown...');
  server.close(() => {
    logger.info('Server gracefully closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
