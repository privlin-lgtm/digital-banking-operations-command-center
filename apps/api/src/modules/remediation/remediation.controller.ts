import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { ExecuteRemediationBody } from './remediation.schema.js';
import type { RemediationEngine } from './remediation-engine.js';

export class RemediationController {
  constructor(private readonly engine: RemediationEngine) {}

  execute = async (
    req: Request<ParamsDictionary, unknown, ExecuteRemediationBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const result = await this.engine.execute(
      req.body.action,
      { serviceId: req.body.serviceId, incidentId: req.body.incidentId, actorId },
      { autoResolveIncident: req.body.autoResolveIncident },
    );
    const statusCode =
      result.outcome === 'SUCCESS' ? 200 : result.outcome === 'FALLBACK' ? 207 : 502;
    res.status(statusCode).json({ data: result });
  };

  circuitStates = (_req: Request, res: Response): void => {
    res.json({ data: this.engine.getCircuitStates() });
  };
}
