import type { Incident } from '@prisma/client';
import type { EscalationDecision } from '../../src/modules/incidents/escalation-engine.js';
import type { IncidentNotifier } from '../../src/modules/incidents/incident-notifier.js';

export class FakeIncidentNotifier implements IncidentNotifier {
  readonly calls: Array<{ incidentId: string; decision: EscalationDecision }> = [];

  async notifyEscalation(
    incident: Pick<Incident, 'id' | 'title' | 'severity'>,
    decision: EscalationDecision,
  ): Promise<void> {
    this.calls.push({ incidentId: incident.id, decision });
  }
}
