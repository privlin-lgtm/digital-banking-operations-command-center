import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { metricsMiddleware } from './config/metrics.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { alertsRouter } from './modules/alerts/alerts.router.js';
import { auditRouter } from './modules/audit/audit.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { casesRouter } from './modules/cases/cases.router.js';
import { customersRouter } from './modules/customers/customers.router.js';
import { healthRouter } from './modules/health/health.router.js';
import { transactionsRouter } from './modules/transactions/transactions.router.js';
import { usersRouter } from './modules/users/users.router.js';

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(metricsMiddleware());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId ?? 'unknown',
    }),
  );
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
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/alerts', alertsRouter);
  app.use('/api/v1/cases', casesRouter);
  app.use('/api/v1/audit-logs', auditRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
