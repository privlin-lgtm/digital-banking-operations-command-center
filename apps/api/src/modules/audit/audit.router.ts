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
    // AuditLog.id is a BigInt (append-only, high-volume table — see the
    // schema rationale); JSON.stringify throws on bigint, so it has to be
    // downgraded to a string at this HTTP boundary, same as Metric.id.
    res.json({ data: logs.map((log) => ({ ...log, id: log.id.toString() })) });
  }),
);
