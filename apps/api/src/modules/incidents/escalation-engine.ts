import type { UserRole } from '@bankops/shared';
import type { IncidentStatus, Severity } from '@prisma/client';
import { severityPolicy } from './severity.js';

/** The minimal shape the engine needs — deliberately not the full Prisma `Incident`, so this file has zero framework/DB dependency. */
export interface EscalationInput {
  severity: Severity;
  status: IncidentStatus;
  openedAt: Date;
  acknowledgedAt: Date | null;
  escalationLevel: number;
  lastEscalatedAt: Date | null;
}

export type EscalationAction = 'NONE' | 'ESCALATE' | 'MAX_LEVEL_REACHED';

export interface EscalationDecision {
  action: EscalationAction;
  reason: string;
  fromLevel: number;
  toLevel: number;
  toRole: UserRole | null;
  ackSlaBreached: boolean;
  resolveSlaBreached: boolean;
}

const TERMINAL_STATUSES: readonly IncidentStatus[] = ['RESOLVED', 'CLOSED'];

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}

/**
 * Pure decision logic: given an incident's current state and "now", decide
 * whether it should escalate. No I/O — it doesn't read the database, write
 * a timeline event, or page anyone. That's `IncidentEscalationService`'s
 * job (orchestration); this class only answers "should it, and to whom."
 * Keeping the two separate is what makes every edge case below testable
 * with plain object literals and no database.
 */
export class EscalationEngine {
  evaluate(incident: EscalationInput, now: Date): EscalationDecision {
    const policy = severityPolicy(incident.severity);
    const ackSlaBreached =
      incident.acknowledgedAt === null &&
      minutesBetween(incident.openedAt, now) > policy.ackSlaMinutes;
    const resolveSlaBreached =
      !TERMINAL_STATUSES.includes(incident.status) &&
      minutesBetween(incident.openedAt, now) > policy.resolveSlaMinutes;

    const base = {
      fromLevel: incident.escalationLevel,
      toLevel: incident.escalationLevel,
      toRole: null as UserRole | null,
      ackSlaBreached,
      resolveSlaBreached,
    };

    if (TERMINAL_STATUSES.includes(incident.status)) {
      return { ...base, action: 'NONE', reason: 'Incident is already resolved or closed' };
    }

    if (!ackSlaBreached) {
      return {
        ...base,
        action: 'NONE',
        reason: 'Within the acknowledgement SLA for this severity',
      };
    }

    if (incident.escalationLevel >= policy.escalationChain.length) {
      return {
        ...base,
        action: 'MAX_LEVEL_REACHED',
        reason: 'Escalation chain exhausted for this severity',
      };
    }

    // The *first* escalation fires as soon as the ack SLA is breached —
    // escalateAfterMinutes only paces the steps AFTER that (level > 0).
    // Gating level 0 behind this interval too would mean a P1 with a 5m
    // ack SLA and a 10m escalation interval doesn't page anyone until
    // minute 10, silently doubling its effective ack SLA.
    if (incident.escalationLevel > 0) {
      const sinceLastStep = incident.lastEscalatedAt ?? incident.openedAt;
      if (minutesBetween(sinceLastStep, now) < policy.escalateAfterMinutes) {
        return {
          ...base,
          action: 'NONE',
          reason: 'Ack SLA breached, but waiting for the next escalation window',
        };
      }
    }

    return {
      ...base,
      action: 'ESCALATE',
      reason: 'Acknowledgement SLA breached and the escalation window has elapsed',
      toLevel: incident.escalationLevel + 1,
      toRole: policy.escalationChain[incident.escalationLevel] ?? null,
    };
  }
}
