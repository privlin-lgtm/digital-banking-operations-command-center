import type { RemediationActionType } from '../remediation/remediation.types.js';

/**
 * The only slice of RemediationEngine the alert engine needs — same
 * narrow-port pattern as IncidentCreator above it. Closes the "Automated
 * Remediation Engine is never automatically triggered" P1 finding from the
 * production-readiness audit: this is the seam that lets a SEV1 alert
 * transition actually invoke remediation, instead of remediation only
 * ever being reachable via a human calling POST /remediation/execute.
 */
export interface RemediationTrigger {
  execute(
    action: RemediationActionType,
    context: { serviceId?: string; incidentId?: string; actorId: string },
  ): Promise<{ outcome: string; detail: string }>;
}
