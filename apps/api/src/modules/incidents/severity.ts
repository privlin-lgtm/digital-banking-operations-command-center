import type { UserRole } from '@bankops/shared';
import type { Severity } from '@prisma/client';

/**
 * The wire-facing severity taxonomy (P1 Critical .. P4 Low) versus the
 * stored enum (SEV1..SEV4): these stay two different things on purpose.
 *
 * `Severity` is also `Alert.severity` — it's an already-migrated, already-
 * seeded, already-tested column shared across two tables. Renaming the
 * Postgres enum to match a naming preference at the API layer would mean
 * a breaking migration touching Alert as well, for a purely cosmetic
 * change. Instead, P1–P4 lives entirely in this module as the incident
 * API's public vocabulary, translated to/from SEV1–SEV4 at the boundary
 * (schema parsing in, response serialization out) — nothing downstream of
 * the repository layer ever sees a "P1" string.
 */
export type SeverityCode = 'P1' | 'P2' | 'P3' | 'P4';

export interface SeverityLevel {
  code: SeverityCode;
  label: string;
  prismaValue: Severity;
  /** Minutes to acknowledge before the escalation engine considers this breached. */
  ackSlaMinutes: number;
  /** Minutes to resolve before the escalation engine flags a resolve-SLA breach. */
  resolveSlaMinutes: number;
  /** Minutes between escalation steps once the ack SLA has been breached. */
  escalateAfterMinutes: number;
  /**
   * Roles paged in order as the incident keeps breaching its ack SLA.
   * There's no on-call rotation/scheduling system behind this — it names
   * the next ROLE to notify, not a specific person, which is an honest
   * reflection of what's actually modeled here.
   */
  escalationChain: readonly UserRole[];
}

/**
 * A static, versioned policy table rather than DB-editable rows (compare
 * to Runbook, which IS DB-editable): acknowledgement SLAs are a
 * compliance-relevant constant. Changing how fast P1s must be acked
 * should go through code review and a deployment, not a form field any
 * admin can edit unaudited from the UI.
 */
export const SEVERITY_LEVELS: Record<Severity, SeverityLevel> = {
  SEV1: {
    code: 'P1',
    label: 'Critical',
    prismaValue: 'SEV1',
    ackSlaMinutes: 5,
    resolveSlaMinutes: 60,
    escalateAfterMinutes: 10,
    escalationChain: ['RESPONDER', 'COMMANDER', 'ADMIN'],
  },
  SEV2: {
    code: 'P2',
    label: 'High',
    prismaValue: 'SEV2',
    ackSlaMinutes: 15,
    resolveSlaMinutes: 240,
    escalateAfterMinutes: 30,
    escalationChain: ['RESPONDER', 'COMMANDER'],
  },
  SEV3: {
    code: 'P3',
    label: 'Medium',
    prismaValue: 'SEV3',
    ackSlaMinutes: 60,
    resolveSlaMinutes: 1440,
    escalateAfterMinutes: 120,
    escalationChain: ['RESPONDER'],
  },
  SEV4: {
    code: 'P4',
    label: 'Low',
    prismaValue: 'SEV4',
    ackSlaMinutes: 240,
    resolveSlaMinutes: 4320,
    escalateAfterMinutes: 480,
    escalationChain: ['RESPONDER'],
  },
};

const CODE_TO_SEVERITY: Record<SeverityCode, Severity> = {
  P1: 'SEV1',
  P2: 'SEV2',
  P3: 'SEV3',
  P4: 'SEV4',
};

export function severityCodeToPrisma(code: SeverityCode): Severity {
  return CODE_TO_SEVERITY[code];
}

export function severityPolicy(severity: Severity): SeverityLevel {
  return SEVERITY_LEVELS[severity];
}

/** Incidents at this severity or above (P1 is the highest) require an approved RCA before closing. */
export function requiresRcaToClose(severity: Severity): boolean {
  return severity === 'SEV1' || severity === 'SEV2';
}
