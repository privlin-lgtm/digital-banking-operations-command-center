import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createAlertRuleSchema,
  listAlertsQuerySchema,
  updateAlertRuleSchema,
} from './alerts.schema.js';

const RESPONDER_UP = [UserRole.RESPONDER, UserRole.COMMANDER, UserRole.ADMIN] as const;
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createAlertsRouter(): Router {
  const { alerts } = getContainer();
  const router = Router();

  router.use(authenticate);

  // Static /rules/* paths declared before /:id so a rules request never matches the alert-by-id route.
  router.get('/rules/:serviceId', asyncHandler(alerts.controller.listRules));
  router.post(
    '/rules/:serviceId',
    authorize(...COMMANDER_UP),
    validate({ body: createAlertRuleSchema }),
    asyncHandler(alerts.controller.createRule),
  );
  router.patch(
    '/rules/:serviceId/:id',
    authorize(...COMMANDER_UP),
    validate({ body: updateAlertRuleSchema }),
    asyncHandler(alerts.controller.updateRule),
  );

  router.get('/', validate({ query: listAlertsQuerySchema }), asyncHandler(alerts.controller.list));
  router.get('/:id', asyncHandler(alerts.controller.getById));
  router.post(
    '/:id/acknowledge',
    authorize(...RESPONDER_UP),
    asyncHandler(alerts.controller.acknowledge),
  );
  router.post('/:id/resolve', authorize(...RESPONDER_UP), asyncHandler(alerts.controller.resolve));

  return router;
}
