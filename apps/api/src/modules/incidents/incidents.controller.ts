import type { Incident } from '@prisma/client';
import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import { severityCodeToPrisma, severityPolicy } from './severity.js';
import type {
  AssignCommanderBody,
  CreateCommentBody,
  CreateIncidentBody,
  ListIncidentsQuery,
  ReclassifySeverityBody,
  ResolveIncidentBody,
} from './incidents.schema.js';
import type { IncidentsService } from './incidents.service.js';

/**
 * The P1–P4 ↔ SEV1–SEV4 translation lives entirely at this boundary — see
 * severity.ts for why. Everything below the controller (service,
 * repository, database) only ever sees SEV1..SEV4.
 */
function serializeIncident(incident: Incident) {
  const policy = severityPolicy(incident.severity);
  return {
    ...incident,
    severity: policy.code,
    severityLabel: policy.label,
  };
}

export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  list = async (
    req: Request<ParamsDictionary, unknown, unknown, ListIncidentsQuery>,
    res: Response,
  ): Promise<void> => {
    const incidents = await this.incidentsService.list({
      status: req.query.status,
      severity: req.query.severity ? severityCodeToPrisma(req.query.severity) : undefined,
      primaryServiceId: req.query.primaryServiceId,
    });
    res.json({ data: incidents.map(serializeIncident) });
  };

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const incident = await this.incidentsService.getById(req.params.id);
    res.json({ data: serializeIncident(incident) });
  };

  create = async (
    req: Request<ParamsDictionary, unknown, CreateIncidentBody>,
    res: Response,
  ): Promise<void> => {
    const user = requireUser(req);
    const incident = await this.incidentsService.create(
      {
        title: req.body.title,
        severity: severityCodeToPrisma(req.body.severity),
        primaryServiceId: req.body.primaryServiceId,
        commanderId: req.body.commanderId,
        alertIds: req.body.alertIds,
      },
      user.id,
      user.role,
    );
    res.status(201).json({ data: serializeIncident(incident) });
  };

  reclassifySeverity = async (
    req: Request<{ id: string }, unknown, ReclassifySeverityBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.reclassifySeverity(
      req.params.id,
      severityCodeToPrisma(req.body.severity),
      actorId,
    );
    res.json({ data: serializeIncident(incident) });
  };

  assign = async (
    req: Request<{ id: string }, unknown, AssignCommanderBody>,
    res: Response,
  ): Promise<void> => {
    const user = requireUser(req);
    const incident = await this.incidentsService.assign(
      req.params.id,
      req.body.commanderId,
      user.id,
      user.role,
    );
    res.json({ data: serializeIncident(incident) });
  };

  acknowledge = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.acknowledge(req.params.id, actorId);
    res.json({ data: serializeIncident(incident) });
  };

  mitigate = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.mitigate(req.params.id, actorId);
    res.json({ data: serializeIncident(incident) });
  };

  resolve = async (
    req: Request<{ id: string }, unknown, ResolveIncidentBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.resolve(
      req.params.id,
      req.body.resolutionSummary,
      actorId,
    );
    res.json({ data: serializeIncident(incident) });
  };

  close = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.close(req.params.id, actorId);
    res.json({ data: serializeIncident(incident) });
  };

  reopen = async (
    req: Request<{ id: string }, unknown, { reason?: string }>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const incident = await this.incidentsService.reopen(
      req.params.id,
      req.body.reason ?? 'Reopened',
      actorId,
    );
    res.json({ data: serializeIncident(incident) });
  };

  addComment = async (
    req: Request<{ id: string }, unknown, CreateCommentBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const comment = await this.incidentsService.addComment(req.params.id, actorId, req.body.body);
    res.status(201).json({ data: comment });
  };

  getTimeline = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const feed = await this.incidentsService.getTimeline(req.params.id);
    res.json({ data: feed });
  };

  getComments = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const comments = await this.incidentsService.getComments(req.params.id);
    res.json({ data: comments });
  };
}
