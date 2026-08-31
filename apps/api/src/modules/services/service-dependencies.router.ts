import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createServiceDependencySchema } from './service-dependencies.schema.js';

/** Mounted at /api/v1/services/:id/dependencies — needs mergeParams to see the parent :id. */
export function createServiceDependenciesRouter(): Router {
  const { serviceDependencies } = getContainer();
  const router = Router({ mergeParams: true });

  router.use(authenticate);

  router.get('/', asyncHandler(serviceDependencies.controller.list));
  router.get('/dependents', asyncHandler(serviceDependencies.controller.listDependents));
  router.get('/blast-radius', asyncHandler(serviceDependencies.controller.blastRadius));

  router.post(
    '/',
    authorize(UserRole.ADMIN, UserRole.COMMANDER),
    validate({ body: createServiceDependencySchema }),
    asyncHandler(serviceDependencies.controller.create),
  );

  router.delete(
    '/:dependencyId',
    authorize(UserRole.ADMIN, UserRole.COMMANDER),
    asyncHandler(serviceDependencies.controller.remove),
  );

  return router;
}
