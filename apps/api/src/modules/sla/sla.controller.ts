import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { CalculateSlaBody, HistoryQuery, WindowTypeQuery } from './sla.schema.js';
import type { SlaTrackingService } from './sla.service.js';

export class SlaController {
  constructor(private readonly slaService: SlaTrackingService) {}

  getLatest = async (
    req: Request<{ serviceId: string }, unknown, unknown, WindowTypeQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.slaService.getLatest(req.params.serviceId, req.query.windowType);
    res.json({ data });
  };

  getHistory = async (
    req: Request<{ serviceId: string }, unknown, unknown, HistoryQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.slaService.getHistory(
      req.params.serviceId,
      req.query.windowType,
      req.query.limit,
    );
    res.json({ data });
  };

  getBreaches = async (
    req: Request<ParamsDictionary, unknown, unknown, WindowTypeQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.slaService.getCurrentBreaches(req.query.windowType);
    res.json({ data });
  };

  calculate = async (
    req: Request<{ serviceId: string }, unknown, CalculateSlaBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.slaService.calculateForService(
      req.params.serviceId,
      req.body.windowType,
      req.body.windowStart,
      req.body.windowEnd,
      req.body.targetPercent,
      actorId,
    );
    res.json({ data });
  };

  rollup = async (_req: Request, res: Response): Promise<void> => {
    const actorId = requireUser(_req).id;
    const data = await this.slaService.runRollup(actorId);
    res.json({ data });
  };
}
