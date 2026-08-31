import type { Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { IncidentEscalationService } from './incident-escalation.service.js';

export class IncidentEscalationController {
  constructor(private readonly escalationService: IncidentEscalationService) {}

  preview = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const decision = await this.escalationService.previewDecision(req.params.id);
    res.json({ data: decision });
  };

  sweep = async (req: Request, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    const result = await this.escalationService.runSweep(actorId);
    res.json({ data: result });
  };
}
