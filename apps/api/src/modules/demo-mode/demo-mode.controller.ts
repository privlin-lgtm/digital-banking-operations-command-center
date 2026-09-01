import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { DemoModeService } from './demo-mode.service.js';
import type { EnableDemoModeBody } from './demo-mode.schema.js';

export class DemoModeController {
  constructor(private readonly demoModeService: DemoModeService) {}

  getState = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.demoModeService.getState();
    res.json({ data });
  };

  enable = async (
    req: Request<ParamsDictionary, unknown, EnableDemoModeBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.demoModeService.enable(req.body, actorId);
    res.status(200).json({ data });
  };

  disable = async (req: Request, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.demoModeService.disable(actorId);
    res.status(200).json({ data });
  };
}
