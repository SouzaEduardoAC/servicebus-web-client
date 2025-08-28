import helmet from 'helmet';
import pinoHttp from 'pino-http';
import cors from 'cors';
import { logger, allowedOrigins, apiKey } from './config.js';

export const httpLogger = pinoHttp({ logger });

export const helmetMiddleware = helmet();

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

export const corsMiddleware = cors(corsOptions);

export const apiKeyMiddleware = (req, res, next) => {
  if (apiKey && req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
