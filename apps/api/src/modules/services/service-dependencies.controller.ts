import type { Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type { CreateServiceDependencyBody } from './service-dependencies.schema.js';
import type { ServiceDependencyService } from './service-dependencies.service.js';

export class ServiceDependenciesController {
  constructor(private readonly dependencyService: ServiceDependencyService) {}

  list = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.dependencyService.listDependencies(req.params.id);
    res.json({ data });
  };

  listDependents = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.dependencyService.listDependents(req.params.id);
    res.json({ data });
  };

  blastRadius = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.dependencyService.getBlastRadius(req.params.id);
    res.json({ data });
  };

  create = async (
    req: Request<{ id: string }, unknown, CreateServiceDependencyBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.dependencyService.addDependency(req.params.id, req.body, actorId);
    res.status(201).json({ data });
  };

  remove = async (
    req: Request<{ id: string; dependencyId: string }>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    await this.dependencyService.removeDependency(req.params.id, req.params.dependencyId, actorId);
    res.status(204).send();
  };
}
