import type { IncidentResolver } from '../../src/modules/remediation/remediation-engine.js';

export class FakeIncidentResolver implements IncidentResolver {
  readonly calls: Array<{ incidentId: string; resolutionSummary: string; actorId: string }> = [];

  async resolve(incidentId: string, resolutionSummary: string, actorId: string): Promise<unknown> {
    this.calls.push({ incidentId, resolutionSummary, actorId });
    return { id: incidentId, status: 'RESOLVED' };
  }
}
