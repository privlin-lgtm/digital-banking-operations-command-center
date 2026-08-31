import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type {
  ApproveRcaReportBody,
  CreateCorrectiveActionBody,
  CreateRcaReportBody,
  OpenActionsQuery,
  UpdateRcaReportBody,
} from './rca.schema.js';
import type { RcaService } from './rca.service.js';

export class RcaController {
  constructor(private readonly rcaService: RcaService) {}

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.rcaService.getById(req.params.id);
    res.json({ data });
  };

  getByIncidentId = async (req: Request<{ incidentId: string }>, res: Response): Promise<void> => {
    const data = await this.rcaService.getByIncidentId(req.params.incidentId);
    res.json({ data });
  };

  create = async (
    req: Request<{ incidentId: string }, unknown, CreateRcaReportBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.create({
      ...req.body,
      incidentId: req.params.incidentId,
      authoredById: actorId,
    });
    res.status(201).json({ data });
  };

  update = async (
    req: Request<{ id: string }, unknown, UpdateRcaReportBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.update(req.params.id, req.body, actorId);
    res.json({ data });
  };

  submit = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.submitForReview(req.params.id, actorId);
    res.json({ data });
  };

  approve = async (
    req: Request<{ id: string }, unknown, ApproveRcaReportBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.approve(req.params.id, req.body.reviewedById, actorId);
    res.json({ data });
  };

  addAction = async (
    req: Request<{ id: string }, unknown, CreateCorrectiveActionBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.addCorrectiveAction(
      { ...req.body, rcaReportId: req.params.id },
      actorId,
    );
    res.status(201).json({ data });
  };

  completeAction = async (req: Request<{ actionId: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.rcaService.markActionComplete(req.params.actionId, actorId);
    res.json({ data });
  };

  getActions = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.rcaService.getCorrectiveActions(req.params.id);
    res.json({ data });
  };

  getOpenActions = async (
    req: Request<ParamsDictionary, unknown, unknown, OpenActionsQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.rcaService.getOpenActions(req.query);
    res.json({ data });
  };

  generateReport = async (req: Request<{ incidentId: string }>, res: Response): Promise<void> => {
    const { markdown } = await this.rcaService.generateReport(req.params.incidentId);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(markdown);
  };
}
