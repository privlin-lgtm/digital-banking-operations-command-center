import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, email: true, name: true } } },
    });
    res.json({ data: logs });
  }),
);
