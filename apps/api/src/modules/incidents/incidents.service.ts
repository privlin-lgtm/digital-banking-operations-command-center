import type { UserRole } from '@bankops/shared';
import type { Incident, IncidentStatus, Severity } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { ServicesRepository } from '../services/services.types.js';
import type { IncidentRcaGate } from './incident-rca-gate.js';
import type { UserLookup } from './user-lookup.js';
import { requiresRcaToClose } from './severity.js';
import {
  canTransition,
  type CreateIncidentInput,
  type IncidentCommentsRepository,
  type IncidentTimelineRepository,
  type IncidentsRepository,
  type ListIncidentsFilter,
} from './incidents.types.js';

export interface TimelineFeedItem {
  kind: 'EVENT' | 'COMMENT';
  id: string;
  createdAt: Date;
  actorId: string | null;
  body: string;
  eventType?: string;
  metadata?: unknown;
}

/**
 * The full incident lifecycle lives here: creation, reclassification,
 * ownership, every state transition, comments, and the merged timeline
 * read. Nothing here knows about HTTP or Prisma directly — only the
 * repository/gate/lookup interfaces — so every rule below (the state
 * machine, the RCA-before-close gate, the self-assign-only-for-responders
 * rule) is unit-testable against hand-written fakes.
 */
export class IncidentsService {
  constructor(
    private readonly repository: IncidentsRepository,
    private readonly timelineRepository: IncidentTimelineRepository,
    private readonly commentsRepository: IncidentCommentsRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly rcaGate: IncidentRcaGate,
    private readonly userLookup: UserLookup,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  list(filter: ListIncidentsFilter): Promise<Incident[]> {
    return this.repository.findMany(filter);
  }

  async getById(id: string): Promise<Incident> {
    const incident = await this.repository.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident "${id}" not found`);
    }
    return incident;
  }

  async create(
    input: CreateIncidentInput,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Incident> {
    const service = await this.servicesRepository.findById(input.primaryServiceId);
    if (!service) {
      throw new NotFoundError(`Service "${input.primaryServiceId}" not found`);
    }

    let commanderId: string | null = null;
    if (input.commanderId) {
      await this.assertCanAssign(actorId, actorRole, input.commanderId);
      commanderId = input.commanderId;
    }

    const incident = await this.repository.create({
      title: input.title,
      severity: input.severity,
      primaryServiceId: input.primaryServiceId,
      commanderId,
    });

    if (input.alertIds && input.alertIds.length > 0) {
      await this.repository.linkAlerts(incident.id, input.alertIds);
    }

    await this.appendTimeline(
      incident.id,
      'CREATED',
      `Incident opened at ${input.severity} against ${service.name}`,
      actorId,
    );
    this.logger.info({ incidentId: incident.id, severity: incident.severity }, 'Incident created');
    await this.auditLogger.record({
      actorId,
      action: 'incident.create',
      entityType: 'Incident',
      entityId: incident.id,
      metadata: { severity: incident.severity, primaryServiceId: incident.primaryServiceId },
    });

    return incident;
  }

  async reclassifySeverity(id: string, severity: Severity, actorId: string): Promise<Incident> {
    const current = await this.getById(id);
    if (current.severity === severity) {
      return current;
    }

    const updated = await this.repository.updateSeverity(id, severity);
    await this.appendTimeline(
      id,
      'SEVERITY_CHANGED',
      `Reclassified from ${current.severity} to ${severity}`,
      actorId,
      {
        from: current.severity,
        to: severity,
      },
    );
    await this.auditLogger.record({
      actorId,
      action: 'incident.reclassify',
      entityType: 'Incident',
      entityId: id,
      metadata: { from: current.severity, to: severity },
    });
    return updated;
  }

  /** Commanders/admins can assign anyone; a responder may only claim the incident for themselves. */
  async assign(
    id: string,
    commanderId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Incident> {
    await this.getById(id);
    await this.assertCanAssign(actorId, actorRole, commanderId);

    const updated = await this.repository.assignCommander(id, commanderId);
    await this.appendTimeline(id, 'ASSIGNED', `Commander assigned`, actorId, { commanderId });
    await this.auditLogger.record({
      actorId,
      action: 'incident.assign',
      entityType: 'Incident',
      entityId: id,
      metadata: { commanderId },
    });
    return updated;
  }

  async acknowledge(id: string, actorId: string): Promise<Incident> {
    const incident = await this.getById(id);
    this.assertTransition(incident.status, 'ACKNOWLEDGED');

    const updated = await this.repository.transitionStatus(id, 'ACKNOWLEDGED', {
      acknowledgedAt: new Date(),
    });
    await this.appendTimeline(id, 'ACKNOWLEDGED', 'Incident acknowledged', actorId);
    await this.auditLogger.record({
      actorId,
      action: 'incident.acknowledge',
      entityType: 'Incident',
      entityId: id,
    });
    return updated;
  }

  async mitigate(id: string, actorId: string): Promise<Incident> {
    const incident = await this.getById(id);
    this.assertTransition(incident.status, 'MITIGATED');

    const updated = await this.repository.transitionStatus(id, 'MITIGATED', {});
    await this.appendTimeline(
      id,
      'MITIGATED',
      'Impact mitigated; monitoring for full resolution',
      actorId,
    );
    await this.auditLogger.record({
      actorId,
      action: 'incident.mitigate',
      entityType: 'Incident',
      entityId: id,
    });
    return updated;
  }

  async resolve(id: string, resolutionSummary: string, actorId: string): Promise<Incident> {
    const incident = await this.getById(id);
    this.assertTransition(incident.status, 'RESOLVED');

    const updated = await this.repository.transitionStatus(id, 'RESOLVED', {
      resolvedAt: new Date(),
      resolutionSummary,
    });
    await this.appendTimeline(id, 'RESOLVED', resolutionSummary, actorId);
    await this.auditLogger.record({
      actorId,
      action: 'incident.resolve',
      entityType: 'Incident',
      entityId: id,
      metadata: { resolutionSummary },
    });
    return updated;
  }

  /**
   * Enterprise banking rule carried over from the platform's original
   * design: a P1/P2 cannot be closed without an approved RCA on file. A
   * P3/P4 can — the bar for a low-severity incident's paperwork is lower.
   */
  async close(id: string, actorId: string): Promise<Incident> {
    const incident = await this.getById(id);
    this.assertTransition(incident.status, 'CLOSED');

    if (requiresRcaToClose(incident.severity)) {
      const hasApprovedRca = await this.rcaGate.hasApprovedRca(id);
      if (!hasApprovedRca) {
        throw new ConflictError(
          `Cannot close a ${incident.severity} incident without an approved RCA report`,
        );
      }
    }

    const updated = await this.repository.transitionStatus(id, 'CLOSED', { closedAt: new Date() });
    await this.appendTimeline(id, 'CLOSED', 'Incident closed', actorId);
    await this.auditLogger.record({
      actorId,
      action: 'incident.close',
      entityType: 'Incident',
      entityId: id,
    });
    return updated;
  }

  async reopen(id: string, reason: string, actorId: string): Promise<Incident> {
    const incident = await this.getById(id);
    this.assertTransition(incident.status, 'OPEN');

    const updated = await this.repository.transitionStatus(id, 'OPEN', {});
    await this.appendTimeline(id, 'REOPENED', reason, actorId);
    await this.auditLogger.record({
      actorId,
      action: 'incident.reopen',
      entityType: 'Incident',
      entityId: id,
      metadata: { reason },
    });
    return updated;
  }

  async addComment(id: string, authorId: string, body: string) {
    await this.getById(id);
    const comment = await this.commentsRepository.create({ incidentId: id, authorId, body });
    await this.auditLogger.record({
      actorId: authorId,
      action: 'incident.comment',
      entityType: 'Incident',
      entityId: id,
    });
    return comment;
  }

  async getComments(id: string) {
    await this.getById(id);
    return this.commentsRepository.findByIncidentId(id);
  }

  /** System events and user comments, merged into one chronological narrative. */
  async getTimeline(id: string): Promise<TimelineFeedItem[]> {
    await this.getById(id);
    const [events, comments] = await Promise.all([
      this.timelineRepository.findByIncidentId(id),
      this.commentsRepository.findByIncidentId(id),
    ]);

    const feed: TimelineFeedItem[] = [
      ...events.map((event) => ({
        kind: 'EVENT' as const,
        id: event.id,
        createdAt: event.createdAt,
        actorId: event.actorId,
        body: event.message,
        eventType: event.type,
        metadata: event.metadata,
      })),
      ...comments.map((comment) => ({
        kind: 'COMMENT' as const,
        id: comment.id,
        createdAt: comment.createdAt,
        actorId: comment.authorId,
        body: comment.body,
      })),
    ];

    return feed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private assertTransition(from: IncidentStatus, to: IncidentStatus): void {
    if (!canTransition(from, to)) {
      throw new ValidationError(`Cannot move an incident from ${from} to ${to}`);
    }
  }

  private async assertCanAssign(
    actorId: string,
    actorRole: UserRole,
    targetCommanderId: string,
  ): Promise<void> {
    if (actorRole === 'RESPONDER' && targetCommanderId !== actorId) {
      throw new ValidationError('Responders may only assign incidents to themselves');
    }
    const isActive = await this.userLookup.isActiveUser(targetCommanderId);
    if (!isActive) {
      throw new NotFoundError(`User "${targetCommanderId}" not found or inactive`);
    }
  }

  private async appendTimeline(
    incidentId: string,
    type: Parameters<IncidentTimelineRepository['append']>[0]['type'],
    message: string,
    actorId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.timelineRepository.append({ incidentId, type, message, actorId, metadata });
  }
}
