import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { enableDemoModeSchema } from './demo-mode.schema.js';

// Starting a live chaos-and-recovery narrative against real services is the
// same trust tier as the chaos-engineering Failure Simulator it's built on
// top of — a viewer or responder should never be able to fire this off
// mid-shift.
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createDemoModeRouter(): Router {
  const { demoMode } = getContainer();
  const router = Router();

  router.use(authenticate);

  router.get('/', asyncHandler(demoMode.controller.getState));
  router.post(
    '/enable',
    authorize(...COMMANDER_UP),
    validate({ body: enableDemoModeSchema }),
    asyncHandler(demoMode.controller.enable),
  );
  router.post('/disable', authorize(...COMMANDER_UP), asyncHandler(demoMode.controller.disable));

  return router;
}
