export const UserRole = {
  ADMIN: 'ADMIN',
  OPERATIONS: 'OPERATIONS',
  COMPLIANCE: 'COMPLIANCE',
  ANALYST: 'ANALYST',
  READONLY: 'READONLY',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertStatus = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;

export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const CaseStatus = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CLOSED: 'CLOSED',
} as const;

export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  FLAGGED: 'FLAGGED',
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];
