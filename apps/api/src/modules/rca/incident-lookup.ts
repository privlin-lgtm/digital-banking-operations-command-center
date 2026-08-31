import type { PrismaClient } from '@prisma/client';

/** Narrow port, same pattern used across every module that only needs to confirm an incident exists (see runbooks/incident-lookup.ts, incidents/incident-rca-gate.ts). */
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
