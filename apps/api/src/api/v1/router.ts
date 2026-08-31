import { Router } from 'express';
import { createAlertsRouter } from '../../modules/alerts/alerts.router.js';
import { auditRouter } from '../../modules/audit/audit.router.js';
import { authRouter } from '../../modules/auth/auth.router.js';
import { createFailureSimulatorRouter } from '../../modules/failure-simulator/failure-simulator.router.js';
import { healthRouter } from '../../modules/health/health.router.js';
import { createIncidentsRouter } from '../../modules/incidents/incidents.router.js';
import { createRcaRouter } from '../../modules/rca/rca.router.js';
import { createRemediationRouter } from '../../modules/remediation/remediation.router.js';
import { createRunbooksRouter } from '../../modules/runbooks/runbooks.router.js';
import { createSlaRouter } from '../../modules/sla/sla.router.js';
import { createServicesRouter } from '../../modules/services/services.router.js';
import { usersRouter } from '../../modules/users/users.router.js';

/**
 * API versioning strategy
 * ------------------------
 * Versioning happens at this layer — the router/schema/DTO boundary — and
 * nowhere else. Domain logic (services, repositories) is version-agnostic
 * and shared; only the wire contract changes between versions.
 *
 *   - A new version is a new `src/api/v2/router.ts`, mounted alongside v1
 *     in app.ts (`app.use('/api/v2', createV2Router())`), never a v1
 *     replacement in place.
 *   - v2 imports the SAME controllers/services as v1 wherever the contract
 *     is unchanged, and only adds its own controller + zod schema for the
 *     handful of endpoints that actually changed shape.
 *   - A version is retired by responding with `Deprecation` and `Sunset`
 *     headers (RFC 8594) for an announced window, then removing its router
 *     — clients on an old version get advance warning instead of a sudden
 *     404.
 *   - Breaking change = new version (renamed/removed field, changed status
 *     code, changed auth requirement). Additive change = same version (new
 *     optional field, new endpoint, new enum member consumers must
 *     already treat as forward-compatible).
 */
export function createV1Router(): Router {
  const router = Router();

  router.use(healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);
  router.use('/services', createServicesRouter());
  router.use('/incidents', createIncidentsRouter());
  router.use('/remediation', createRemediationRouter());
  router.use('/runbooks', createRunbooksRouter());
  router.use('/sla', createSlaRouter());
  router.use('/rca', createRcaRouter());
  router.use('/alerts', createAlertsRouter());
  router.use('/failure-simulations', createFailureSimulatorRouter());
  router.use('/audit-logs', auditRouter);

  return router;
}
