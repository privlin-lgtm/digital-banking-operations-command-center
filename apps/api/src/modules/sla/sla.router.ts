import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { calculateSlaSchema, historyQuerySchema, windowTypeQuerySchema } from './sla.schema.js';

const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createSlaRouter(): Router {
  const { sla } = getContainer();
  const router = Router();

  router.use(authenticate);

  // Dashboard/reporting reads — any authenticated role.
  router.get(
    '/breaches',
    validate({ query: windowTypeQuerySchema }),
    asyncHandler(sla.controller.getBreaches),
  );
  router.get(
    '/services/:serviceId/latest',
    validate({ query: windowTypeQuerySchema }),
    asyncHandler(sla.controller.getLatest),
  );
  router.get(
    '/services/:serviceId/history',
    validate({ query: historyQuerySchema }),
    asyncHandler(sla.controller.getHistory),
  );

  // Recomputation is an operational action, not a read.
  router.post(
    '/services/:serviceId/calculate',
    authorize(...COMMANDER_UP),
    validate({ body: calculateSlaSchema }),
    asyncHandler(sla.controller.calculate),
  );
  router.post('/rollup', authorize(UserRole.ADMIN), asyncHandler(sla.controller.rollup));

  return router;
}
