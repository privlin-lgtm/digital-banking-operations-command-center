import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';

export const customersRouter = Router();

customersRouter.use(authenticate);

customersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: customers });
  }),
);
