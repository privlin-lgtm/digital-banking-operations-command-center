import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const auditRouter = Router();

// Every row here is "who did what" across the whole platform, including
// security-relevant events (LOGIN/LOGOUT, role-gated actions, service
// archival). That's an ADMIN-only record in any real bank, not something
// a VIEWER's read-only access should extend to just because they're
// logged in.
auditRouter.use(authenticate, authorize(UserRole.ADMIN));

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
