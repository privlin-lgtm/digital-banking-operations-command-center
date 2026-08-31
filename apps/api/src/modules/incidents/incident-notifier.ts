import type { Logger } from 'pino';
import type { Incident } from '@prisma/client';
import type { EscalationDecision } from './escalation-engine.js';

/**
 * The seam where a real paging integration (PagerDuty, Opsgenie, a Slack
 * webhook) would plug in. `IncidentEscalationService` depends on this
 * interface, not on any specific vendor SDK — swapping the adapter below
 * for a real one is the only change needed to start actually paging
 * someone.
 */
export interface IncidentNotifier {
  notifyEscalation(
    incident: Pick<Incident, 'id' | 'title' | 'severity'>,
    decision: EscalationDecision,
  ): Promise<void>;
}

/** Stands in for a paging integration: logs structurally instead of calling out to anything. */
export class LoggingIncidentNotifier implements IncidentNotifier {
  constructor(private readonly logger: Logger) {}

  async notifyEscalation(
    incident: Pick<Incident, 'id' | 'title' | 'severity'>,
    decision: EscalationDecision,
  ): Promise<void> {
    this.logger.warn(
      {
        incidentId: incident.id,
        severity: incident.severity,
        toLevel: decision.toLevel,
        toRole: decision.toRole,
      },
      `Would page ${decision.toRole ?? 'unknown role'}: "${incident.title}" breached its acknowledgement SLA`,
    );
  }
}
