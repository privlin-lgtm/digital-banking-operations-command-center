import type { Incident, IncidentStatus, PrismaClient, Severity } from '@prisma/client';
import type { IncidentsRepository, ListIncidentsFilter } from './incidents.types.js';

const ACTIVE_STATUSES: readonly IncidentStatus[] = ['OPEN', 'ACKNOWLEDGED', 'MITIGATED'];

export class PrismaIncidentsRepository implements IncidentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findMany(filter: ListIncidentsFilter): Promise<Incident[]> {
    return this.prisma.incident.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.severity ? { severity: filter.severity } : {}),
        ...(filter.primaryServiceId ? { primaryServiceId: filter.primaryServiceId } : {}),
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  findById(id: string): Promise<Incident | null> {
    return this.prisma.incident.findUnique({ where: { id } });
  }

  create(input: {
    title: string;
    severity: Severity;
    primaryServiceId: string;
    commanderId: string | null;
  }): Promise<Incident> {
    return this.prisma.incident.create({
      data: {
        title: input.title,
        severity: input.severity,
        primaryServiceId: input.primaryServiceId,
        commanderId: input.commanderId,
        // A commander assigned at creation time counts as an immediate ack —
        // there's no one left to acknowledge on their own behalf.
        acknowledgedAt: input.commanderId ? new Date() : null,
        status: input.commanderId ? 'ACKNOWLEDGED' : 'OPEN',
      },
    });
  }

  updateSeverity(id: string, severity: Severity): Promise<Incident> {
    return this.prisma.incident.update({ where: { id }, data: { severity } });
  }

  assignCommander(id: string, commanderId: string): Promise<Incident> {
    return this.prisma.incident.update({ where: { id }, data: { commanderId } });
  }

  transitionStatus(
    id: string,
    to: IncidentStatus,
    fields: {
      acknowledgedAt?: Date;
      resolvedAt?: Date;
      closedAt?: Date;
      resolutionSummary?: string;
    },
  ): Promise<Incident> {
    return this.prisma.incident.update({
      where: { id },
      data: {
        status: to,
        ...(fields.acknowledgedAt ? { acknowledgedAt: fields.acknowledgedAt } : {}),
        ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
        ...(fields.closedAt ? { closedAt: fields.closedAt } : {}),
        ...(fields.resolutionSummary ? { resolutionSummary: fields.resolutionSummary } : {}),
        // Reopening clears the terminal timestamps so a stale resolvedAt/
        // closedAt doesn't linger on an incident that's active again.
        ...(to === 'OPEN'
          ? {
              resolvedAt: null,
              closedAt: null,
              acknowledgedAt: null,
              escalationLevel: 0,
              lastEscalatedAt: null,
            }
          : {}),
      },
    });
  }

  recordEscalation(id: string, toLevel: number, at: Date): Promise<Incident> {
    return this.prisma.incident.update({
      where: { id },
      data: { escalationLevel: toLevel, lastEscalatedAt: at },
    });
  }

  async linkAlerts(incidentId: string, alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) {
      return;
    }
    // Only claims alerts that aren't already attached to some other
    // incident — this must never let one incident hijack another's alert.
    await this.prisma.alert.updateMany({
      where: { id: { in: alertIds }, incidentId: null },
      data: { incidentId },
    });
  }

  findActiveForEscalation(): Promise<Incident[]> {
    return this.prisma.incident.findMany({ where: { status: { in: [...ACTIVE_STATUSES] } } });
  }
}
