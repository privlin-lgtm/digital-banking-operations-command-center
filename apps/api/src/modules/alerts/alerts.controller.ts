import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { CreateAlertRuleBody, ListAlertsQuery, UpdateAlertRuleBody } from './alerts.schema.js';
import type { AlertsService } from './alerts.service.js';

export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  list = async (
    req: Request<ParamsDictionary, unknown, unknown, ListAlertsQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.alertsService.list(req.query);
    res.json({ data });
  };

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.alertsService.getById(req.params.id);
    res.json({ data });
  };

  acknowledge = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.alertsService.acknowledge(req.params.id, actorId);
    res.json({ data });
  };

  resolve = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.alertsService.resolve(req.params.id, actorId);
    res.json({ data });
  };

  listRules = async (req: Request<{ serviceId: string }>, res: Response): Promise<void> => {
    const data = await this.alertsService.listRulesForService(req.params.serviceId);
    res.json({ data });
  };

  createRule = async (
    req: Request<{ serviceId: string }, unknown, CreateAlertRuleBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.alertsService.createRule({
      ...req.body,
      serviceId: req.params.serviceId,
      createdById: actorId,
    });
    res.status(201).json({ data });
  };

  updateRule = async (
    req: Request<{ id: string }, unknown, UpdateAlertRuleBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.alertsService.updateRule(req.params.id, req.body, actorId);
    res.json({ data });
  };
}
