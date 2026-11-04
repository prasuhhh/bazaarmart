import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import orderRoutes from './routes/orderRoutes.js';
import productRoutes from './routes/productRoutes.js';
import { createUserRoutes } from './routes/userRoutes.js';
import { ok } from './utils/response.js';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Only failed attempts count, so normal users are never locked out.
function createAuthLimiter(limit) {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Please try again in 15 minutes.'
    })
  });
}

export function createApp({ authRateLimit = 10 } = {}) {
  const app = express();

  // Hosts like Render sit behind one proxy; the limiter needs the real client IP.
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());
  // Express 5 leaves req.body undefined when a request has no JSON body.
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });

  app.get('/', (_req, res) => ok(res, { message: 'BazaarMart API is running.' }));
  app.use('/api', createUserRoutes({
    loginLimiter: createAuthLimiter(authRateLimit),
    registerLimiter: createAuthLimiter(authRateLimit)
  }));
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
