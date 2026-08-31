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
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        transaction: { select: { id: true, reference: true, amount: true } },
      },
    });
    res.json({ data: alerts });
  }),
);
