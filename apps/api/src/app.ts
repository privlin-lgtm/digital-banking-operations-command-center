import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createV1Router } from './api/v1/router.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { metricsMiddleware } from './config/metrics.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // --- Cross-cutting middleware, in deliberate order --------------------
  // 1. requestId: every later middleware/handler/log line can correlate to
  //    one request, including the ones below that run before pino-http.
  app.use(requestId);
  // 2. metrics: timed around the whole pipeline, including auth/validation
  //    failures — a 401 or 422 is still a request the RED dashboards must see.
  app.use(metricsMiddleware());
  // 3. structured request logging, tagged with the same requestId.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId ?? 'unknown',
    }),
  );
  // 4. security headers before anything touches the request body.
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // 5. rate limiting after parsing is cheap enough, and before it means an
  //    oversized body could be parsed before ever being counted.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  // --- Routes -------------------------------------------------------------
  // See src/api/v1/router.ts for the versioning strategy this mount point
  // is built around.
  app.use('/api/v1', createV1Router());

  // --- Terminal handlers ---------------------------------------------------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
