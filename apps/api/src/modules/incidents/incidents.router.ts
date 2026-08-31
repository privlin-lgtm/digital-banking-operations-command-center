import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  assignCommanderSchema,
  createCommentSchema,
  createIncidentSchema,
  listIncidentsQuerySchema,
  reclassifySeveritySchema,
  resolveIncidentSchema,
} from './incidents.schema.js';

const RESPONDER_UP = [UserRole.RESPONDER, UserRole.COMMANDER, UserRole.ADMIN] as const;
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createIncidentsRouter(): Router {
  const { incidents, incidentEscalation } = getContainer();
  const router = Router();

  router.use(authenticate);

  // Escalation sweep is a fixed, non-parameterized path — declared before
  // "/:id" routes so Express never tries to match "escalations" as an id.
  router.post(
    '/escalations/sweep',
    authorize(UserRole.ADMIN),
    asyncHandler(incidentEscalation.controller.sweep),
  );

  router.get(
    '/',
    validate({ query: listIncidentsQuerySchema }),
    asyncHandler(incidents.controller.list),
  );
  router.post(
    '/',
    authorize(...RESPONDER_UP),
    validate({ body: createIncidentSchema }),
    asyncHandler(incidents.controller.create),
  );

  router.get('/:id', asyncHandler(incidents.controller.getById));
  router.get('/:id/timeline', asyncHandler(incidents.controller.getTimeline));
  router.get('/:id/escalation', asyncHandler(incidentEscalation.controller.preview));

  router.patch(
    '/:id/severity',
    authorize(...COMMANDER_UP),
    validate({ body: reclassifySeveritySchema }),
    asyncHandler(incidents.controller.reclassifySeverity),
  );

  router.post(
    '/:id/assign',
    authorize(...RESPONDER_UP),
    validate({ body: assignCommanderSchema }),
    asyncHandler(incidents.controller.assign),
  );

  router.post(
    '/:id/acknowledge',
    authorize(...RESPONDER_UP),
    asyncHandler(incidents.controller.acknowledge),
  );
  router.post(
    '/:id/mitigate',
    authorize(...RESPONDER_UP),
    asyncHandler(incidents.controller.mitigate),
  );

  router.post(
    '/:id/resolve',
    authorize(...RESPONDER_UP),
    validate({ body: resolveIncidentSchema }),
    asyncHandler(incidents.controller.resolve),
  );

  // Closing (and the RCA gate it enforces for P1/P2) requires sign-off authority.
  router.post('/:id/close', authorize(...COMMANDER_UP), asyncHandler(incidents.controller.close));
  router.post('/:id/reopen', authorize(...COMMANDER_UP), asyncHandler(incidents.controller.reopen));

  router.get('/:id/comments', asyncHandler(incidents.controller.getComments));
  router.post(
    '/:id/comments',
    authorize(...RESPONDER_UP),
    validate({ body: createCommentSchema }),
    asyncHandler(incidents.controller.addComment),
  );

  return router;
}
