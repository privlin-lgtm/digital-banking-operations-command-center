import type { UserRole } from '@bankops/shared';
import type { Severity } from '@prisma/client';

/** The only slice of IncidentsService the alert engine needs — same narrow-port pattern as RemediationEngine's IncidentResolver. */
export interface IncidentCreator {
  create(
    input: { title: string; severity: Severity; primaryServiceId: string; alertIds?: string[] },
    actorId: string,
    actorRole: UserRole,
  ): Promise<{ id: string }>;
}
