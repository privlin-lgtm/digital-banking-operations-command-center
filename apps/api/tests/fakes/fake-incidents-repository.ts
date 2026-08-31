import type { Incident, IncidentStatus, Severity } from '@prisma/client';
import type {
  IncidentsRepository,
  ListIncidentsFilter,
} from '../../src/modules/incidents/incidents.types.js';

let idCounter = 0;

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  idCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `inc-${idCounter}`,
    title: overrides.title ?? 'Test incident',
    severity: overrides.severity ?? 'SEV3',
    status: overrides.status ?? 'OPEN',
    primaryServiceId: overrides.primaryServiceId ?? 'svc-1',
    commanderId: overrides.commanderId ?? null,
    openedAt: overrides.openedAt ?? now,
    acknowledgedAt: overrides.acknowledgedAt ?? null,
    resolvedAt: overrides.resolvedAt ?? null,
    closedAt: overrides.closedAt ?? null,
    resolutionSummary: overrides.resolutionSummary ?? null,
    escalationLevel: overrides.escalationLevel ?? 0,
    lastEscalatedAt: overrides.lastEscalatedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export class FakeIncidentsRepository implements IncidentsRepository {
  private readonly rows = new Map<string, Incident>();

  seed(incident: Incident): Incident {
    this.rows.set(incident.id, incident);
    return incident;
  }

  async findMany(filter: ListIncidentsFilter): Promise<Incident[]> {
    return [...this.rows.values()].filter(
      (incident) =>
        (!filter.status || incident.status === filter.status) &&
        (!filter.severity || incident.severity === filter.severity) &&
        (!filter.primaryServiceId || incident.primaryServiceId === filter.primaryServiceId),
    );
  }

  async findById(id: string): Promise<Incident | null> {
    return this.rows.get(id) ?? null;
  }

  async create(input: {
    title: string;
    severity: Severity;
    primaryServiceId: string;
    commanderId: string | null;
  }): Promise<Incident> {
    const incident = makeIncident({
      ...input,
      acknowledgedAt: input.commanderId ? new Date() : null,
      status: input.commanderId ? 'ACKNOWLEDGED' : 'OPEN',
    });
    this.rows.set(incident.id, incident);
    return incident;
  }

  async updateSeverity(id: string, severity: Severity): Promise<Incident> {
    return this.mutate(id, { severity });
  }

  async assignCommander(id: string, commanderId: string): Promise<Incident> {
    return this.mutate(id, { commanderId });
  }

  async transitionStatus(
    id: string,
    to: IncidentStatus,
    fields: {
      acknowledgedAt?: Date;
      resolvedAt?: Date;
      closedAt?: Date;
      resolutionSummary?: string;
    },
  ): Promise<Incident> {
    return this.mutate(id, {
      status: to,
      ...(fields.acknowledgedAt ? { acknowledgedAt: fields.acknowledgedAt } : {}),
      ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
      ...(fields.closedAt ? { closedAt: fields.closedAt } : {}),
      ...(fields.resolutionSummary ? { resolutionSummary: fields.resolutionSummary } : {}),
      ...(to === 'OPEN'
        ? {
            resolvedAt: null,
            closedAt: null,
            acknowledgedAt: null,
            escalationLevel: 0,
            lastEscalatedAt: null,
          }
        : {}),
    });
  }

  async recordEscalation(id: string, toLevel: number, at: Date): Promise<Incident> {
    return this.mutate(id, { escalationLevel: toLevel, lastEscalatedAt: at });
  }

  async linkAlerts(): Promise<void> {
    // No Alert model in this fake — tests exercising create() don't assert on linked alerts.
  }

  async findActiveForEscalation(): Promise<Incident[]> {
    return [...this.rows.values()].filter((incident) =>
      ['OPEN', 'ACKNOWLEDGED', 'MITIGATED'].includes(incident.status),
    );
  }

  private mutate(id: string, patch: Partial<Incident>): Incident {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`FakeIncidentsRepository: "${id}" not found`);
    }
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}
