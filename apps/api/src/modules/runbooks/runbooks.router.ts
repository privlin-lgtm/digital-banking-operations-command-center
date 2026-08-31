import { Router } from 'express';
import { UserRole } from '@bankops/shared';
import { getContainer } from '../../container.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createRunbookSchema,
  linkRunbookSchema,
  recordOutcomeSchema,
  searchRunbooksQuerySchema,
  updateRunbookSchema,
} from './runbooks.schema.js';

const RESPONDER_UP = [UserRole.RESPONDER, UserRole.COMMANDER, UserRole.ADMIN] as const;
const COMMANDER_UP = [UserRole.COMMANDER, UserRole.ADMIN] as const;

export function createRunbooksRouter(): Router {
  const { runbooks } = getContainer();
  const router = Router();

  router.use(authenticate);

  router.get(
    '/',
    validate({ query: searchRunbooksQuerySchema }),
    asyncHandler(runbooks.controller.search),
  );
  router.get('/incidents/:incidentId/links', asyncHandler(runbooks.controller.getLinksForIncident));
  router.get('/:id', asyncHandler(runbooks.controller.getById));

  router.post(
    '/',
    authorize(...COMMANDER_UP),
    validate({ body: createRunbookSchema }),
    asyncHandler(runbooks.controller.create),
  );

  router.patch(
    '/:id',
    authorize(...COMMANDER_UP),
    validate({ body: updateRunbookSchema }),
    asyncHandler(runbooks.controller.update),
  );

  router.post(
    '/:id/link',
    authorize(...RESPONDER_UP),
    validate({ body: linkRunbookSchema }),
    asyncHandler(runbooks.controller.link),
  );

  router.patch(
    '/links/:linkId/outcome',
    authorize(...RESPONDER_UP),
    validate({ body: recordOutcomeSchema }),
    asyncHandler(runbooks.controller.recordOutcome),
  );

  return router;
}
