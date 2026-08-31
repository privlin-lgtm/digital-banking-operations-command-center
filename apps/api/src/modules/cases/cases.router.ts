import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';

export const casesRouter = Router();

casesRouter.use(authenticate);

casesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cases = await prisma.case.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, fullName: true, externalId: true } },
      },
    });
    res.json({ data: cases });
  }),
);
