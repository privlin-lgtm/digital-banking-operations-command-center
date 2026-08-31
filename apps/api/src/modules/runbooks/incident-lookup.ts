import type { PrismaClient } from '@prisma/client';

/** Narrow port, same pattern as IncidentRcaGate/UserLookup: linking a runbook only needs to know the incident exists. */
export interface IncidentLookup {
  exists(incidentId: string): Promise<boolean>;
}

export class PrismaIncidentLookup implements IncidentLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async exists(incidentId: string): Promise<boolean> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    return incident !== null;
  }
}
