import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createServiceDependenciesRouter } from './service-dependencies.router.js';
import { createServiceMetricsRouter } from './service-metrics.router.js';
import {
  createServiceSchema,
  listServicesQuerySchema,
  updateServiceSchema,
  updateServiceStatusSchema,
} from './services.schema.js';

export function createServicesRouter(): Router {
  const { services } = getContainer();
  const router = Router();

  router.use(authenticate);

  router.get(
    '/',
    validate({ query: listServicesQuerySchema }),
    asyncHandler(services.controller.list),
  );
  router.get('/:id', asyncHandler(services.controller.getById));

  // Registering a service in the catalog is an operational change, not a
  // read — restricted to roles that own production topology decisions.
  router.post(
    '/',
    authorize(UserRole.ADMIN, UserRole.COMMANDER),
    validate({ body: createServiceSchema }),
    asyncHandler(services.controller.create),
  );

  router.patch(
    '/:id',
    authorize(UserRole.ADMIN, UserRole.COMMANDER),
    validate({ body: updateServiceSchema }),
    asyncHandler(services.controller.update),
  );

  // Status changes are allowed for responders too — they're the ones
  // acting on an incident who need to flip a service to DEGRADED/CRITICAL
  // without catalog-edit rights.
  router.patch(
    '/:id/status',
    authorize(UserRole.ADMIN, UserRole.COMMANDER, UserRole.RESPONDER),
    validate({ body: updateServiceStatusSchema }),
    asyncHandler(services.controller.updateStatus),
  );

  // Archival (never a hard delete — see the schema note on Service.archivedAt)
  // is admin-only and, per ServicesService.archive, blocked while anything
  // still depends on or has an open incident against this service.
  router.delete('/:id', authorize(UserRole.ADMIN), asyncHandler(services.controller.archive));

  router.use('/:id/dependencies', createServiceDependenciesRouter());
  router.use('/:id/metrics', createServiceMetricsRouter());

  return router;
}
