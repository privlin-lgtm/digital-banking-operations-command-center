import type { Incident } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { NotFoundError } from '../../lib/errors.js';
import type { EscalationDecision, EscalationEngine, EscalationInput } from './escalation-engine.js';
import type { IncidentNotifier } from './incident-notifier.js';
import type { IncidentTimelineRepository, IncidentsRepository } from './incidents.types.js';

export interface SweepResult {
  checked: number;
  escalated: number;
  maxLevelReached: number;
}

function toEscalationInput(incident: Incident): EscalationInput {
  return {
    severity: incident.severity,
    status: incident.status,
    openedAt: incident.openedAt,
    acknowledgedAt: incident.acknowledgedAt,
    escalationLevel: incident.escalationLevel,
    lastEscalatedAt: incident.lastEscalatedAt,
  };
}

/**
 * The automated workflow: periodically (see the scheduler wired in
 * server.ts) or on demand, sweep every active incident through the
 * EscalationEngine and act on anything that comes back `ESCALATE`. This
 * is the orchestration layer around a pure decision function — it's the
 * piece that actually touches the database, writes a timeline entry,
 * calls the notifier, and records an audit entry.
 */
export class IncidentEscalationService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly timelineRepository: IncidentTimelineRepository,
    private readonly notifier: IncidentNotifier,
    private readonly auditLogger: AuditLogger,
    private readonly engine: EscalationEngine,
    private readonly logger: Logger,
  ) {}

  /** Dry-run preview for a single incident — what would the next sweep do, without doing it. */
  async previewDecision(incidentId: string): Promise<EscalationDecision> {
    const incident = await this.incidentsRepository.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident "${incidentId}" not found`);
    }
    return this.engine.evaluate(toEscalationInput(incident), new Date());
  }

  /**
   * Runs across every active incident. Idempotent and safe to call
   * repeatedly — an incident that isn't due for another escalation step
   * simply comes back `NONE` and nothing happens to it.
   *
   * NOTE on scale: this is an in-process sweep, triggered either by the
   * interval in server.ts or the admin-gated HTTP endpoint. It works
   * correctly on a single instance. Running more than one API instance
   * would run the sweep N times per interval — each run is idempotent so
   * nothing gets double-escalated, but it's still redundant work. A
   * multi-instance deployment should move this to a single external
   * scheduler (a Kubernetes CronJob, or a queue consumer with a leader
   * election lock) hitting the HTTP endpoint instead of relying on every
   * instance's own timer.
   */
  async runSweep(actorId: string): Promise<SweepResult> {
    const now = new Date();
    const candidates = await this.incidentsRepository.findActiveForEscalation();

    let escalated = 0;
    let maxLevelReached = 0;

    for (const incident of candidates) {
      const decision = this.engine.evaluate(toEscalationInput(incident), now);

      if (decision.action === 'MAX_LEVEL_REACHED') {
        maxLevelReached += 1;
        continue;
      }

      if (decision.action !== 'ESCALATE') {
        continue;
      }

      await this.incidentsRepository.recordEscalation(incident.id, decision.toLevel, now);
      await this.timelineRepository.append({
        incidentId: incident.id,
        type: 'ESCALATED',
        message: `Escalated to ${decision.toRole ?? 'next tier'} (level ${decision.toLevel}) — ${decision.reason}`,
        actorId: null,
        metadata: {
          fromLevel: decision.fromLevel,
          toLevel: decision.toLevel,
          toRole: decision.toRole,
        },
      });
      await this.notifier.notifyEscalation(incident, decision);
      await this.auditLogger.record({
        actorId,
        action: 'incident.escalate',
        entityType: 'Incident',
        entityId: incident.id,
        metadata: { toLevel: decision.toLevel, toRole: decision.toRole },
      });
      escalated += 1;
    }

    this.logger.info(
      { checked: candidates.length, escalated, maxLevelReached },
      'Escalation sweep complete',
    );
    return { checked: candidates.length, escalated, maxLevelReached };
  }
}
