import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listSimulationsQuerySchema, startSimulationSchema } from './failure-simulator.schema.js';

// Starting or stopping fault injection against a service is restricted to
// the same roles that own production topology decisions (services.router's
// create/update) — a chaos-engineering trigger is not something a viewer
// or responder should be able to fire off mid-incident.
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createFailureSimulatorRouter(): Router {
  const { failureSimulator } = getContainer();
  const router = Router();

  router.use(authenticate);

  router.get(
    '/',
    validate({ query: listSimulationsQuerySchema }),
    asyncHandler(failureSimulator.controller.list),
  );
  router.get('/:id', asyncHandler(failureSimulator.controller.getById));
  router.post(
    '/',
    authorize(...COMMANDER_UP),
    validate({ body: startSimulationSchema }),
    asyncHandler(failureSimulator.controller.start),
  );
  router.post(
    '/:id/stop',
    authorize(...COMMANDER_UP),
    asyncHandler(failureSimulator.controller.stop),
  );

  return router;
}
