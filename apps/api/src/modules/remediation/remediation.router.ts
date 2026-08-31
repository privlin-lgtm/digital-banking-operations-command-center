import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { executeRemediationSchema } from './remediation.schema.js';

export function createRemediationRouter(): Router {
  const { remediation } = getContainer();
  const router = Router();

  router.use(authenticate);

  router.get('/circuit-breakers', remediation.controller.circuitStates);

  router.post(
    '/execute',
    authorize(UserRole.RESPONDER, UserRole.COMMANDER, UserRole.ADMIN),
    validate({ body: executeRemediationSchema }),
    asyncHandler(remediation.controller.execute),
  );

  return router;
}
