import type { Alert, AlertComparator, AlertRule, AlertState, Severity } from '@prisma/client';

export interface CreateAlertRuleInput {
  serviceId: string;
  metricName: string;
  comparator: AlertComparator;
  criticalThreshold?: number | undefined;
  highThreshold?: number | undefined;
  mediumThreshold?: number | undefined;
  lowThreshold?: number | undefined;
  createdById: string;
}

export interface UpdateAlertRuleInput {
  comparator?: AlertComparator | undefined;
  criticalThreshold?: number | undefined;
  highThreshold?: number | undefined;
  mediumThreshold?: number | undefined;
  lowThreshold?: number | undefined;
  isActive?: boolean | undefined;
}

export interface ListAlertsFilter {
  serviceId?: string | undefined;
  state?: AlertState | undefined;
  severity?: Severity | undefined;
}

export interface FireOrUpdateAlertInput {
  serviceId: string;
  ruleName: string;
  severity: Severity;
  fingerprint: string;
}

export interface AlertRulesRepository {
  findByServiceAndMetric(serviceId: string, metricName: string): Promise<AlertRule | null>;
  findById(id: string): Promise<AlertRule | null>;
  findByServiceId(serviceId: string): Promise<AlertRule[]>;
  create(input: CreateAlertRuleInput): Promise<AlertRule>;
  update(id: string, input: UpdateAlertRuleInput): Promise<AlertRule>;
}

export interface AlertsRepository {
  findMany(filter: ListAlertsFilter): Promise<Alert[]>;
  findById(id: string): Promise<Alert | null>;
  /** The one currently-FIRING alert for this (service, rule), if any — the row the partial unique index guarantees is unique. */
  findFiring(serviceId: string, ruleName: string): Promise<Alert | null>;
  fireOrUpdate(input: FireOrUpdateAlertInput): Promise<Alert>;
  acknowledge(id: string): Promise<Alert>;
  resolve(id: string): Promise<Alert>;
  linkToIncident(id: string, incidentId: string): Promise<Alert>;
}
