import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { ListSimulationsQuery, StartSimulationBody } from './failure-simulator.schema.js';
import type { FailureSimulatorService } from './failure-simulator.service.js';

export class FailureSimulatorController {
  constructor(private readonly failureSimulatorService: FailureSimulatorService) {}

  list = async (
    req: Request<ParamsDictionary, unknown, unknown, ListSimulationsQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.failureSimulatorService.list(req.query);
    res.json({ data });
  };

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.failureSimulatorService.getById(req.params.id);
    res.json({ data });
  };

  start = async (
    req: Request<ParamsDictionary, unknown, StartSimulationBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.failureSimulatorService.start(req.body, actorId);
    res.status(201).json({ data });
  };

  stop = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.failureSimulatorService.stop(req.params.id, actorId);
    res.json({ data });
  };
}
