import type { PrismaClient } from '@prisma/client';

/**
 * A thin, single-method seam onto RcaReport — deliberately not a full RCA
 * module (RCA Reports get their own module later). `IncidentsService`
 * only ever needs one fact about a report: is it approved. Depending on
 * this narrow port instead of a full RcaReportsRepository keeps that
 * dependency honest about how little incident closure actually needs to
 * know about root-cause analysis.
 */
export interface IncidentRcaGate {
  hasApprovedRca(incidentId: string): Promise<boolean>;
}

export class PrismaIncidentRcaGate implements IncidentRcaGate {
  constructor(private readonly prisma: PrismaClient) {}

  async hasApprovedRca(incidentId: string): Promise<boolean> {
    const report = await this.prisma.rcaReport.findUnique({
      where: { incidentId },
      select: { status: true },
    });
    return report?.status === 'APPROVED';
  }
}
