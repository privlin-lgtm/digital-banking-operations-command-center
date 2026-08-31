import type { ParamsDictionary, Request, Response } from 'express-serve-static-core';
import { requireUser } from '../../lib/require-user.js';
import type {
  CreateServiceBody,
  ListServicesQuery,
  UpdateServiceBody,
  UpdateServiceStatusBody,
} from './services.schema.js';
import type { ServicesService } from './services.service.js';

/**
 * Controllers are thin on purpose: translate HTTP in, call the service,
 * translate the result back to HTTP. No business rules here — that's
 * what makes the same ServicesService reusable from a v2 router, a CLI
 * command, or a background job without duplicating logic.
 */
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  list = async (
    req: Request<ParamsDictionary, unknown, unknown, ListServicesQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.servicesService.list(req.query);
    res.json({ data });
  };

  getById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const data = await this.servicesService.getById(req.params.id);
    res.json({ data });
  };

  create = async (
    req: Request<ParamsDictionary, unknown, CreateServiceBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.servicesService.register(req.body, actorId);
    res.status(201).json({ data });
  };

  update = async (
    req: Request<{ id: string }, unknown, UpdateServiceBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.servicesService.update(req.params.id, req.body, actorId);
    res.json({ data });
  };

  updateStatus = async (
    req: Request<{ id: string }, unknown, UpdateServiceStatusBody>,
    res: Response,
  ): Promise<void> => {
    const actorId = requireUser(req).id;
    const data = await this.servicesService.updateStatus(req.params.id, req.body.status, actorId);
    res.json({ data });
  };

  archive = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actorId = requireUser(req).id;
    await this.servicesService.archive(req.params.id, actorId);
    res.status(204).send();
  };
}
