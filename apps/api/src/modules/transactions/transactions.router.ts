import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';

export const transactionsRouter = Router();

transactionsRouter.use(authenticate);

transactionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const transactions = await prisma.transaction.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 100,
      include: { customer: { select: { id: true, fullName: true, externalId: true } } },
    });
    res.json({ data: transactions });
  }),
);
