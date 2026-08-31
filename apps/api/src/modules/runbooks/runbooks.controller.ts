import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type {
  CreateRunbookBody,
  LinkRunbookBody,
  RecordOutcomeBody,
  SearchRunbooksQuery,
  UpdateRunbookBody,
} from './runbooks.schema.js';
import type { RunbooksService } from './runbooks.service.js';

export class RunbooksController {
  constructor(private readonly runbooksService: RunbooksService) {}

  search = async (
    req: Request<ParamsDictionary, unknown, unknown, SearchRunbooksQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.runbooksService.search({
      query: req.query.q,
      category: req.query.category,
      isActive: req.query.isActive,
    });
    res.json({ data });
  };

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.runbooksService.getById(req.params.id);
    res.json({ data });
  };

  create = async (
    req: Request<ParamsDictionary, unknown, CreateRunbookBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.runbooksService.create({ ...req.body, createdById: actorId });
    res.status(201).json({ data });
  };

  update = async (
    req: Request<{ id: string }, unknown, UpdateRunbookBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.runbooksService.update(req.params.id, req.body, actorId);
    res.json({ data });
  };

  link = async (
    req: Request<{ id: string }, unknown, LinkRunbookBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.runbooksService.linkToIncident(
      req.params.id,
      req.body.incidentId,
      actorId,
    );
    res.status(201).json({ data });
  };

  recordOutcome = async (
    req: Request<{ linkId: string }, unknown, RecordOutcomeBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.runbooksService.recordOutcome(
      req.params.linkId,
      req.body.outcome,
      actorId,
    );
    res.json({ data });
  };

  getLinksForIncident = async (
    req: Request<{ incidentId: string }>,
    res: Response,
  ): Promise<void> => {
    const data = await this.runbooksService.getLinksForIncident(req.params.incidentId);
    res.json({ data });
  };
}
