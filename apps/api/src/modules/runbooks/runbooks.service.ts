import type { RunbookOutcome } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { IncidentLookup } from './incident-lookup.js';
import type {
  CreateRunbookInput,
  RunbooksRepository,
  SearchRunbooksFilter,
  UpdateRunbookInput,
} from './runbooks.types.js';

export class RunbooksService {
  constructor(
    private readonly repository: RunbooksRepository,
    private readonly incidentLookup: IncidentLookup,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  search(filter: SearchRunbooksFilter) {
    return this.repository.search(filter);
  }

  async getById(id: string) {
    const runbook = await this.repository.findById(id);
    if (!runbook) {
      throw new NotFoundError(`Runbook "${id}" not found`);
    }
    return runbook;
  }

  async create(input: CreateRunbookInput) {
    const existing = await this.repository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Runbook slug "${input.slug}" is already registered`);
    }

    const runbook = await this.repository.create(input);
    this.logger.info({ runbookId: runbook.id, category: runbook.category }, 'Runbook created');
    await this.auditLogger.record({
      actorId: input.createdById,
      action: 'runbook.create',
      entityType: 'Runbook',
      entityId: runbook.id,
      metadata: { slug: runbook.slug, category: runbook.category },
    });
    return runbook;
  }

  async update(id: string, input: UpdateRunbookInput, actorId: string) {
    await this.getById(id);
    const updated = await this.repository.update(id, input);
    await this.auditLogger.record({
      actorId,
      action: 'runbook.update',
      entityType: 'Runbook',
      entityId: id,
      metadata: { ...input, newVersion: updated.version },
    });
    return updated;
  }

  /** Associates a runbook with an incident for reference/tracking, in a PENDING state, before anyone runs it. */
  async linkToIncident(runbookId: string, incidentId: string, actorId: string) {
    const runbook = await this.getById(runbookId);

    const incidentExists = await this.incidentLookup.exists(incidentId);
    if (!incidentExists) {
      throw new NotFoundError(`Incident "${incidentId}" not found`);
    }

    const link = await this.repository.linkToIncident(incidentId, runbookId, runbook.version);
    await this.auditLogger.record({
      actorId,
      action: 'runbook.link',
      entityType: 'Incident',
      entityId: incidentId,
      metadata: { runbookId, runbookVersion: runbook.version },
    });
    return link;
  }

  async recordOutcome(linkId: string, outcome: RunbookOutcome, actorId: string, automated = false) {
    const link = await this.repository.findLinkById(linkId);
    if (!link) {
      throw new NotFoundError(`Runbook link "${linkId}" not found`);
    }
    if (link.outcome !== 'PENDING') {
      throw new ValidationError(
        `This runbook link already has a recorded outcome (${link.outcome})`,
      );
    }

    const updated = await this.repository.recordOutcome(
      linkId,
      outcome,
      automated ? null : actorId,
      automated,
    );
    await this.auditLogger.record({
      actorId,
      action: 'runbook.execution_recorded',
      entityType: 'Incident',
      entityId: link.incidentId,
      metadata: { runbookId: link.runbookId, outcome },
    });
    return updated;
  }

  getLinksForIncident(incidentId: string) {
    return this.repository.findLinksForIncident(incidentId);
  }
}
