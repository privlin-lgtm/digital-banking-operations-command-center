import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { getMetrics, metricsContentType } from '../../config/metrics.js';
import { asyncHandler } from '../../lib/async-handler.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'bankops-api',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  }),
);

healthRouter.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', metricsContentType());
    res.status(200).send(await getMetrics());
  }),
);
