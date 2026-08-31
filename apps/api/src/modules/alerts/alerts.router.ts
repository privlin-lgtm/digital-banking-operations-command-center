import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';

export const alertsRouter = Router();

alertsRouter.use(authenticate);

alertsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const alerts = await prisma.alert.findMany({
      orderBy: { firedAt: 'desc' },
      take: 100,
      include: {
        service: { select: { id: true, name: true, tier: true } },
        incident: { select: { id: true, status: true } },
      },
    });
    res.json({ data: alerts });
  }),
);
