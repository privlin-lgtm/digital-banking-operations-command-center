import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listMetricsQuerySchema, recordMetricSchema } from './service-metrics.schema.js';

/** Mounted at /api/v1/services/:id/metrics — needs mergeParams to see the parent :id. */
export function createServiceMetricsRouter(): Router {
  const { serviceHealth } = getContainer();
  const router = Router({ mergeParams: true });

  router.use(authenticate);

  router.get(
    '/',
    validate({ query: listMetricsQuerySchema }),
    asyncHandler(serviceHealth.controller.list),
  );
  router.get('/health', asyncHandler(serviceHealth.controller.snapshot));

  // Any operational role (not just admins) can push a metric sample — this
  // is the endpoint a monitoring agent or the remediation worker calls.
  router.post(
    '/',
    authorize(UserRole.ADMIN, UserRole.COMMANDER, UserRole.RESPONDER),
    validate({ body: recordMetricSchema }),
    asyncHandler(serviceHealth.controller.record),
  );

  return router;
}
