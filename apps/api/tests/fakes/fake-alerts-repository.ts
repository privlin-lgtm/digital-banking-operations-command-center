import type { UserRole } from '@bankops/shared';
import type { Alert, AlertRule, Severity } from '@prisma/client';
import type {
  AlertRulesRepository,
  AlertsRepository,
  CreateAlertRuleInput,
  FireOrUpdateAlertInput,
  ListAlertsFilter,
  UpdateAlertRuleInput,
} from '../../src/modules/alerts/alerts.types.js';
import type { IncidentCreator } from '../../src/modules/alerts/incident-creator.js';
import type { RemediationTrigger } from '../../src/modules/alerts/remediation-trigger.js';
import type { RemediationActionType } from '../../src/modules/remediation/remediation.types.js';

let ruleCounter = 0;
let alertCounter = 0;

export function makeAlertRule(overrides: Partial<AlertRule> = {}): AlertRule {
  ruleCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `rule-${ruleCounter}`,
    serviceId: overrides.serviceId ?? 'svc-1',
    metricName: overrides.metricName ?? 'latency_p99',
    comparator: overrides.comparator ?? 'GREATER_THAN',
    criticalThreshold: overrides.criticalThreshold ?? 2000,
    highThreshold: overrides.highThreshold ?? 1000,
    mediumThreshold: overrides.mediumThreshold ?? 500,
    lowThreshold: overrides.lowThreshold ?? null,
    autoRemediateAction: overrides.autoRemediateAction ?? null,
    isActive: overrides.isActive ?? true,
    createdById: overrides.createdById ?? 'user-1',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export class FakeAlertRulesRepository implements AlertRulesRepository {
  private readonly rows = new Map<string, AlertRule>();

  seed(rule: AlertRule): AlertRule {
    this.rows.set(rule.id, rule);
    return rule;
  }

  async findByServiceAndMetric(serviceId: string, metricName: string): Promise<AlertRule | null> {
    return (
      [...this.rows.values()].find(
        (r) => r.serviceId === serviceId && r.metricName === metricName,
      ) ?? null
    );
  }

  async findById(id: string): Promise<AlertRule | null> {
    return this.rows.get(id) ?? null;
  }

  async findByServiceId(serviceId: string): Promise<AlertRule[]> {
    return [...this.rows.values()].filter((r) => r.serviceId === serviceId);
  }

  async create(input: CreateAlertRuleInput): Promise<AlertRule> {
    const rule = makeAlertRule({
      ...input,
      criticalThreshold: input.criticalThreshold ?? null,
      highThreshold: input.highThreshold ?? null,
      mediumThreshold: input.mediumThreshold ?? null,
      lowThreshold: input.lowThreshold ?? null,
      autoRemediateAction: input.autoRemediateAction ?? null,
    });
    this.rows.set(rule.id, rule);
    return rule;
  }

  async update(id: string, input: UpdateAlertRuleInput): Promise<AlertRule> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`FakeAlertRulesRepository: "${id}" not found`);
    const updated: AlertRule = {
      ...existing,
      ...(input.comparator !== undefined ? { comparator: input.comparator } : {}),
      ...(input.criticalThreshold !== undefined
        ? { criticalThreshold: input.criticalThreshold }
        : {}),
      ...(input.highThreshold !== undefined ? { highThreshold: input.highThreshold } : {}),
      ...(input.mediumThreshold !== undefined ? { mediumThreshold: input.mediumThreshold } : {}),
      ...(input.lowThreshold !== undefined ? { lowThreshold: input.lowThreshold } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.autoRemediateAction !== undefined
        ? { autoRemediateAction: input.autoRemediateAction }
        : {}),
    };
    this.rows.set(id, updated);
    return updated;
  }
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  alertCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `alert-${alertCounter}`,
    serviceId: overrides.serviceId ?? 'svc-1',
    incidentId: overrides.incidentId ?? null,
    ruleName: overrides.ruleName ?? 'latency_p99',
    severity: overrides.severity ?? 'SEV3',
    state: overrides.state ?? 'FIRING',
    fingerprint: overrides.fingerprint ?? 'svc-1:latency_p99',
    firedAt: overrides.firedAt ?? now,
    resolvedAt: overrides.resolvedAt ?? null,
    createdAt: overrides.createdAt ?? now,
  };
}

export class FakeAlertsRepository implements AlertsRepository {
  private readonly rows = new Map<string, Alert>();

  seed(alert: Alert): Alert {
    this.rows.set(alert.id, alert);
    return alert;
  }

  async findMany(filter: ListAlertsFilter): Promise<Alert[]> {
    return [...this.rows.values()].filter(
      (a) =>
        (!filter.serviceId || a.serviceId === filter.serviceId) &&
        (!filter.state || a.state === filter.state) &&
        (!filter.severity || a.severity === filter.severity),
    );
  }

  async findById(id: string): Promise<Alert | null> {
    return this.rows.get(id) ?? null;
  }

  async findFiring(serviceId: string, ruleName: string): Promise<Alert | null> {
    return (
      [...this.rows.values()].find(
        (a) => a.serviceId === serviceId && a.ruleName === ruleName && a.state === 'FIRING',
      ) ?? null
    );
  }

  async fireOrUpdate(input: FireOrUpdateAlertInput): Promise<Alert> {
    const existing = await this.findFiring(input.serviceId, input.ruleName);
    if (existing) {
      if (existing.severity === input.severity) return existing;
      const updated = { ...existing, severity: input.severity };
      this.rows.set(existing.id, updated);
      return updated;
    }
    const alert = makeAlert({
      serviceId: input.serviceId,
      ruleName: input.ruleName,
      severity: input.severity,
      fingerprint: input.fingerprint,
      state: 'FIRING',
    });
    this.rows.set(alert.id, alert);
    return alert;
  }

  async acknowledge(id: string): Promise<Alert> {
    const existing = this.mustGet(id);
    const updated = { ...existing, state: 'ACKNOWLEDGED' as const };
    this.rows.set(id, updated);
    return updated;
  }

  async resolve(id: string): Promise<Alert> {
    const existing = this.mustGet(id);
    const updated = { ...existing, state: 'RESOLVED' as const, resolvedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async linkToIncident(id: string, incidentId: string): Promise<Alert> {
    const existing = this.mustGet(id);
    const updated = { ...existing, incidentId };
    this.rows.set(id, updated);
    return updated;
  }

  private mustGet(id: string): Alert {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`FakeAlertsRepository: "${id}" not found`);
    return existing;
  }
}

export class FakeRemediationTrigger implements RemediationTrigger {
  readonly calls: Array<{
    action: RemediationActionType;
    serviceId?: string;
    incidentId?: string;
    actorId: string;
  }> = [];
  outcome: { outcome: string; detail: string } = { outcome: 'SUCCESS', detail: 'fake success' };

  async execute(
    action: RemediationActionType,
    context: { serviceId?: string; incidentId?: string; actorId: string },
  ): Promise<{ outcome: string; detail: string }> {
    this.calls.push({ action, ...context });
    return this.outcome;
  }
}

export class FakeIncidentCreator implements IncidentCreator {
  readonly calls: Array<{
    title: string;
    severity: Severity;
    primaryServiceId: string;
    alertIds?: string[];
  }> = [];
  private counter = 0;

  async create(
    input: { title: string; severity: Severity; primaryServiceId: string; alertIds?: string[] },
    _actorId: string,
    _actorRole: UserRole,
  ): Promise<{ id: string }> {
    this.counter += 1;
    this.calls.push(input);
    return { id: `inc-${this.counter}` };
  }
}
