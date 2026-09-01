import type {
  AlertState,
  IncidentStatus,
  ServiceStatus,
  ServiceTier,
  Severity,
  SlaWindow,
  UserRole,
} from '@bankops/shared';

export interface Envelope<T> {
  data: T;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    database?: { status: 'up' | 'down' };
    services?: Record<string, number> | { status: 'unknown' };
    openIncidents?: Record<string, number> | { status: 'unknown' };
    slaBreaches?: number | null;
  };
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4' | Severity;
  severityLabel?: string;
  status: IncidentStatus;
  primaryServiceId: string;
  commanderId: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface AlertRecord {
  id: string;
  serviceId: string;
  incidentId: string | null;
  ruleName: string;
  severity: Severity;
  state: AlertState;
  firedAt: string;
  resolvedAt: string | null;
}

export interface ServiceRecord {
  id: string;
  name: string;
  slug: string;
  tier: ServiceTier;
  ownerTeam: string;
  status: ServiceStatus;
  createdAt: string;
}

export interface RunbookRecord {
  id: string;
  title: string;
  slug: string;
  category: 'DATABASE' | 'INFRASTRUCTURE' | 'APPLICATION' | 'SECURITY' | 'MONITORING';
  triggerCondition: string;
  steps: unknown;
  version: number;
  isActive: boolean;
}

export interface SlaRecord {
  id: string;
  serviceId: string;
  windowType: SlaWindow;
  windowStart: string;
  windowEnd: string;
  targetPercent: string;
  actualPercent: string;
  breached: boolean;
}

export function isCountMap(
  value: HealthResponse['checks']['services'],
): value is Record<string, number> {
  return Boolean(value) && !('status' in (value as object));
}
