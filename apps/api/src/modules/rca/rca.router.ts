import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  approveRcaReportSchema,
  createCorrectiveActionSchema,
  createRcaReportSchema,
  openActionsQuerySchema,
  updateRcaReportSchema,
} from './rca.schema.js';

const RESPONDER_UP = [UserRole.RESPONDER, UserRole.COMMANDER, UserRole.ADMIN] as const;
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createRcaRouter(): Router {
  const { rca } = getContainer();
  const router = Router();

  router.use(authenticate);

  // Static paths first — Express matches these before they'd ever be
  // mistaken for "/:id".
  router.get(
    '/open-actions',
    validate({ query: openActionsQuerySchema }),
    asyncHandler(rca.controller.getOpenActions),
  );

  router.get('/incidents/:incidentId', asyncHandler(rca.controller.getByIncidentId));
  router.get('/incidents/:incidentId/report', asyncHandler(rca.controller.generateReport));
  router.post(
    '/incidents/:incidentId',
    authorize(...RESPONDER_UP),
    validate({ body: createRcaReportSchema }),
    asyncHandler(rca.controller.create),
  );

  router.post(
    '/actions/:actionId/complete',
    authorize(...RESPONDER_UP),
    asyncHandler(rca.controller.completeAction),
  );

  router.get('/:id', asyncHandler(rca.controller.getById));
  router.patch(
    '/:id',
    authorize(...RESPONDER_UP),
    validate({ body: updateRcaReportSchema }),
    asyncHandler(rca.controller.update),
  );

  router.post('/:id/submit', authorize(...RESPONDER_UP), asyncHandler(rca.controller.submit));

  // Approval is the four-eyes sign-off — commander/admin authority only.
  router.post(
    '/:id/approve',
    authorize(...COMMANDER_UP),
    validate({ body: approveRcaReportSchema }),
    asyncHandler(rca.controller.approve),
  );

  router.get('/:id/actions', asyncHandler(rca.controller.getActions));
  router.post(
    '/:id/actions',
    authorize(...RESPONDER_UP),
    validate({ body: createCorrectiveActionSchema }),
    asyncHandler(rca.controller.addAction),
  );

  return router;
}
