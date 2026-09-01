import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listAuditLogsQuerySchema, type ListAuditLogsQuery } from './audit.schema.js';

export const auditRouter = Router();

// Every row here is "who did what" across the whole platform, including
// security-relevant events (LOGIN/LOGOUT, role-gated actions, service
// archival). That's an ADMIN-only record in any real bank, not something
// a VIEWER's read-only access should extend to just because they're
// logged in.
auditRouter.use(authenticate, authorize(UserRole.ADMIN));

auditRouter.get(
  '/',
  validate({ query: listAuditLogsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListAuditLogsQuery;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      // Cursor is exclusive and rows are ordered newest-first by
      // (createdAt, id) — "older than the last row of the previous page",
      // not an offset, so a page is stable even as new rows keep being
      // appended ahead of it.
      ...(query.cursor ? { id: { lt: BigInt(query.cursor) } } : {}),
    };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { id: 'desc' },
      take: query.limit,
      include: { actor: { select: { id: true, email: true, name: true } } },
    });

    // AuditLog.id is a BigInt (append-only, high-volume table — see the
    // schema rationale); JSON.stringify throws on bigint, so it has to be
    // downgraded to a string at this HTTP boundary, same as Metric.id.
    const data = logs.map((log) => ({ ...log, id: log.id.toString() }));
    const nextCursor = logs.length === query.limit ? data[data.length - 1]!.id : null;

    res.json({ data, nextCursor });
  }),
);
