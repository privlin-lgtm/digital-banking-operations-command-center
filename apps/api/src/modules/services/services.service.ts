import type { ServiceStatus } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type {
  CreateServiceInput,
  ListServicesFilter,
  ServicesRepository,
  UpdateServiceInput,
} from './services.types.js';

/**
 * Business rules live here, not in the router or the repository. Nothing
 * in this class knows about HTTP (no req/res) or SQL (no Prisma import) —
 * it only knows the `ServicesRepository` contract, which is what makes it
 * testable with a plain in-memory fake.
 */
export class ServicesService {
  constructor(
    private readonly repository: ServicesRepository,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  list(filter: ListServicesFilter) {
    return this.repository.findMany(filter);
  }

  async getById(id: string) {
    const service = await this.repository.findById(id);
    if (!service) {
      throw new NotFoundError(`Service "${id}" not found`);
    }
    return service;
  }

  async register(input: CreateServiceInput, actorId: string) {
    const existing = await this.repository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Service slug "${input.slug}" is already registered`);
    }

    const service = await this.repository.create(input);
    this.logger.info({ serviceId: service.id, slug: service.slug }, 'Service registered');
    await this.auditLogger.record({
      actorId,
      action: 'service.create',
      entityType: 'Service',
      entityId: service.id,
      metadata: { slug: service.slug, tier: service.tier },
    });
    return service;
  }

  async update(id: string, input: UpdateServiceInput, actorId: string) {
    await this.getById(id);

    if (input.slug) {
      const conflict = await this.repository.findBySlug(input.slug);
      if (conflict && conflict.id !== id) {
        throw new ConflictError(`Service slug "${input.slug}" is already registered`);
      }
    }

    const updated = await this.repository.update(id, input);
    await this.auditLogger.record({
      actorId,
      action: 'service.update',
      entityType: 'Service',
      entityId: id,
      metadata: { ...input },
    });
    return updated;
  }

  /**
   * Kept separate from `update()` rather than folded into a generic PATCH:
   * a status transition is an operational event with its own audience
   * (on-call, the health dashboard) and its own audit action name
   * ("service.status_change"), not just an incidental field edit.
   */
  async updateStatus(id: string, status: ServiceStatus, actorId: string) {
    const current = await this.getById(id);
    const updated = await this.repository.updateStatus(id, status);

    this.logger.info({ serviceId: id, from: current.status, to: status }, 'Service status updated');
    await this.auditLogger.record({
      actorId,
      action: 'service.status_change',
      entityType: 'Service',
      entityId: id,
      metadata: { from: current.status, to: status },
    });
    return updated;
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.getById(id);

    const [dependents, openIncidents] = await Promise.all([
      this.repository.countDependents(id),
      this.repository.countOpenIncidents(id),
    ]);

    // A DB foreign key would also stop this, but with an opaque P2003 error.
    // Checking here first lets us tell the caller *why*, not just that it
    // failed — the kind of guard that belongs in the domain layer, not the
    // database's error message.
    if (dependents > 0) {
      throw new ConflictError(
        `Cannot delete: ${dependents} service(s) declare a dependency on this service`,
      );
    }
    if (openIncidents > 0) {
      throw new ConflictError(
        `Cannot delete: ${openIncidents} open incident(s) reference this service`,
      );
    }

    await this.repository.delete(id);
    this.logger.info({ serviceId: id }, 'Service deleted');
    await this.auditLogger.record({
      actorId,
      action: 'service.delete',
      entityType: 'Service',
      entityId: id,
    });
  }
}
