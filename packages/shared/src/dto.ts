import type {
  AlertState,
  DependencyType,
  IncidentStatus,
  RcaStatus,
  RunbookOutcome,
  ServiceStatus,
  ServiceTier,
  Severity,
  SlaWindow,
  UserRole,
} from './enums.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface SessionDto {
  user: UserDto;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ServiceDto {
  id: string;
  name: string;
  slug: string;
  tier: ServiceTier;
  ownerTeam: string;
  status: ServiceStatus;
  createdAt: string;
}

export interface ServiceDependencyDto {
  id: string;
  serviceId: string;
  dependsOnServiceId: string;
  dependencyType: DependencyType;
}

export interface AlertDto {
  id: string;
  serviceId: string;
  incidentId: string | null;
  ruleName: string;
  severity: Severity;
  state: AlertState;
  firedAt: string;
  resolvedAt: string | null;
}

export interface IncidentDto {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  primaryServiceId: string;
  commanderId: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface RunbookDto {
  id: string;
  title: string;
  slug: string;
  triggerCondition: string;
  steps: unknown;
  version: number;
  isActive: boolean;
}

export interface RcaReportDto {
  id: string;
  incidentId: string;
  rootCause: string;
  contributingFactors: string | null;
  status: RcaStatus;
  authoredById: string;
  reviewedById: string | null;
  publishedAt: string | null;
}

export interface SlaRecordDto {
  id: string;
  serviceId: string;
  windowType: SlaWindow;
  windowStart: string;
  windowEnd: string;
  targetPercent: string;
  actualPercent: string;
  breached: boolean;
}

export interface AuditLogDto {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}
