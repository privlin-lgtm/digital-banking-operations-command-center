import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { getMetrics, metricsContentType } from '../../config/metrics.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { logger } from '../../config/logger.js';

export const healthRouter = Router();

/**
 * Liveness: is this process alive at all. Never checks a dependency — if
 * it did, a database blip would make an orchestrator restart every
 * instance that talks to it, which is exactly the failure mode liveness
 * probes exist to avoid. If this handler runs, the answer is yes.
 */
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * Readiness: can this instance serve traffic right now. Checks the one
 * dependency that matters for "can I do my job" — the database — and
 * nothing about business state. A failing readiness probe takes the
 * instance out of load-balancer rotation without killing it.
 */
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  }),
);

/**
 * Health: the human-facing rollup. Unlike liveness/readiness this can
 * report "degraded" without failing either probe — a database that's
 * merely slow, or three services in CRITICAL status, is real information
 * an on-call engineer wants on a dashboard, not a boolean. Each check is
 * independently caught so one failing section (e.g. the DB is down)
 * still returns useful information about the rest instead of a bare 500.
 */
healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, unknown> = {};
    let overallStatus: 'healthy' | 'degraded' = 'healthy';

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'up' };
    } catch (error) {
      overallStatus = 'degraded';
      checks.database = { status: 'down' };
      logger.error({ err: error }, 'Health check: database unreachable');
    }

    try {
      const serviceCounts = await prisma.service.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      const byStatus = Object.fromEntries(
        serviceCounts.map((row) => [row.status, row._count._all]),
      );
      checks.services = byStatus;
      if ((byStatus.CRITICAL ?? 0) > 0) {
        overallStatus = 'degraded';
      }
    } catch {
      overallStatus = 'degraded';
      checks.services = { status: 'unknown' };
    }

    try {
      const incidentCounts = await prisma.incident.groupBy({
        by: ['severity'],
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED', 'MITIGATED'] } },
        _count: { _all: true },
      });
      checks.openIncidents = Object.fromEntries(
        incidentCounts.map((row) => [row.severity, row._count._all]),
      );
    } catch {
      checks.openIncidents = { status: 'unknown' };
    }

    try {
      const windowStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      checks.slaBreaches = await prisma.slaRecord.count({
        where: { windowType: 'MONTHLY', windowStart, breached: true },
      });
    } catch {
      checks.slaBreaches = null;
    }

    res.status(200).json({
      status: overallStatus,
      service: 'bankops-api',
      timestamp: new Date().toISOString(),
      checks,
    });
  }),
);

healthRouter.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', metricsContentType());
    res.status(200).send(await getMetrics());
  }),
);
