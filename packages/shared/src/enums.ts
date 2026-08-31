export const UserRole = {
  ADMIN: 'ADMIN',
  COMMANDER: 'COMMANDER',
  RESPONDER: 'RESPONDER',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ServiceTier = {
  TIER_1: 'TIER_1',
  TIER_2: 'TIER_2',
  TIER_3: 'TIER_3',
  TIER_4: 'TIER_4',
} as const;

export type ServiceTier = (typeof ServiceTier)[keyof typeof ServiceTier];

export const ServiceStatus = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  CRITICAL: 'CRITICAL',
  MAINTENANCE: 'MAINTENANCE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const DependencyType = {
  HARD: 'HARD',
  SOFT: 'SOFT',
} as const;

export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

export const Severity = {
  SEV1: 'SEV1',
  SEV2: 'SEV2',
  SEV3: 'SEV3',
  SEV4: 'SEV4',
} as const;

export type Severity = (typeof Severity)[keyof typeof Severity];

export const AlertState = {
  FIRING: 'FIRING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const;

export type AlertState = (typeof AlertState)[keyof typeof AlertState];

export const IncidentStatus = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  MITIGATED: 'MITIGATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const RcaStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
} as const;

export type RcaStatus = (typeof RcaStatus)[keyof typeof RcaStatus];

export const RunbookOutcome = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  PARTIAL: 'PARTIAL',
} as const;

export type RunbookOutcome = (typeof RunbookOutcome)[keyof typeof RunbookOutcome];

export const SlaWindow = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export type SlaWindow = (typeof SlaWindow)[keyof typeof SlaWindow];
