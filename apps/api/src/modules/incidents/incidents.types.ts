import type {
  Incident,
  IncidentComment,
  IncidentStatus,
  IncidentTimelineEvent,
  Severity,
  TimelineEventType,
} from '@prisma/client';

export interface CreateIncidentInput {
  title: string;
  severity: Severity;
  primaryServiceId: string;
  commanderId?: string | undefined;
  /** Existing, not-yet-linked alerts this incident correlates — see Alert.incidentId. */
  alertIds?: string[] | undefined;
}

export interface ListIncidentsFilter {
  status?: IncidentStatus | undefined;
  severity?: Severity | undefined;
  primaryServiceId?: string | undefined;
}

export interface CreateTimelineEventInput {
  incidentId: string;
  type: TimelineEventType;
  message: string;
  actorId?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface CreateCommentInput {
  incidentId: string;
  authorId: string;
  body: string;
}

/**
 * The legal status transitions, expressed as data rather than scattered
 * `if` statements. OPEN must pass through ACKNOWLEDGED before RESOLVED —
 * an incident can't be marked resolved if no one ever owned it — and
 * RESOLVED/CLOSED can both reopen if the issue recurs.
 */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['MITIGATED', 'RESOLVED'],
  MITIGATED: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return INCIDENT_TRANSITIONS[from].includes(to);
}

export interface IncidentsRepository {
  findMany(filter: ListIncidentsFilter): Promise<Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create(input: {
    title: string;
    severity: Severity;
    primaryServiceId: string;
    commanderId: string | null;
  }): Promise<Incident>;
  updateSeverity(id: string, severity: Severity): Promise<Incident>;
  assignCommander(id: string, commanderId: string): Promise<Incident>;
  transitionStatus(
    id: string,
    to: IncidentStatus,
    fields: {
      acknowledgedAt?: Date;
      resolvedAt?: Date;
      closedAt?: Date;
      resolutionSummary?: string;
    },
  ): Promise<Incident>;
  recordEscalation(id: string, toLevel: number, at: Date): Promise<Incident>;
  linkAlerts(incidentId: string, alertIds: string[]): Promise<void>;
  /** Every incident not yet in a terminal status — the escalation sweep's working set. */
  findActiveForEscalation(): Promise<Incident[]>;
}

export interface IncidentTimelineRepository {
  append(input: CreateTimelineEventInput): Promise<IncidentTimelineEvent>;
  findByIncidentId(incidentId: string): Promise<IncidentTimelineEvent[]>;
}

export interface IncidentCommentsRepository {
  create(input: CreateCommentInput): Promise<IncidentComment>;
  findByIncidentId(incidentId: string): Promise<IncidentComment[]>;
}
