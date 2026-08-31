import type { UserRole } from '@bankops/shared';
import type { Alert } from '@prisma/client';
import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { IncidentCreator } from './incident-creator.js';
import type { ThresholdEvaluator } from './threshold-evaluator.js';
import type {
  AlertRulesRepository,
  AlertsRepository,
  CreateAlertRuleInput,
  ListAlertsFilter,
  UpdateAlertRuleInput,
} from './alerts.types.js';

/** Severities that page a human and open an incident automatically the first time they fire — matching the escalation chain's own P1/P2 urgency split. */
const AUTO_INCIDENT_SEVERITIES = new Set(['SEV1', 'SEV2']);

export class AlertsService {
  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly rulesRepository: AlertRulesRepository,
    private readonly incidentCreator: IncidentCreator,
    private readonly evaluator: ThresholdEvaluator,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
  ) {}

  list(filter: ListAlertsFilter) {
    return this.alertsRepository.findMany(filter);
  }

  async getById(id: string) {
    const alert = await this.alertsRepository.findById(id);
    if (!alert) {
      throw new NotFoundError(`Alert "${id}" not found`);
    }
    return alert;
  }

  async createRule(input: CreateAlertRuleInput) {
    const existing = await this.rulesRepository.findByServiceAndMetric(
      input.serviceId,
      input.metricName,
    );
    if (existing) {
      throw new ConflictError(
        `An alert rule already exists for this service and metric — update it instead`,
      );
    }
    if (
      input.criticalThreshold === undefined &&
      input.highThreshold === undefined &&
      input.mediumThreshold === undefined &&
      input.lowThreshold === undefined
    ) {
      throw new ValidationError('At least one severity threshold must be set');
    }

    const rule = await this.rulesRepository.create(input);
    await this.auditLogger.record({
      actorId: input.createdById,
      action: 'alert_rule.create',
      entityType: 'Service',
      entityId: input.serviceId,
      metadata: { metricName: input.metricName },
    });
    return rule;
  }

  async updateRule(id: string, input: UpdateAlertRuleInput, actorId: string) {
    const existing = await this.rulesRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Alert rule "${id}" not found`);
    }
    const updated = await this.rulesRepository.update(id, input);
    await this.auditLogger.record({
      actorId,
      action: 'alert_rule.update',
      entityType: 'Service',
      entityId: existing.serviceId,
    });
    return updated;
  }

  listRulesForService(serviceId: string) {
    return this.rulesRepository.findByServiceId(serviceId);
  }

  /**
   * The engine's core loop: called once per recorded metric sample (see
   * ServiceHealthController), never on a timer. There's no polling —
   * the metric write IS the trigger, which is simpler and has zero
   * evaluation lag compared to a separate scheduled sweep.
   */
  async evaluateMetric(
    serviceId: string,
    metricName: string,
    value: number,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Alert | null> {
    const rule = await this.rulesRepository.findByServiceAndMetric(serviceId, metricName);
    if (!rule || !rule.isActive) {
      return null;
    }

    const severity = this.evaluator.evaluate(value, rule);
    const existingFiring = await this.alertsRepository.findFiring(serviceId, rule.metricName);

    if (severity === null) {
      // No breach: resolve a firing alert if one exists — this is the
      // "auto-close false alerts" behavior. Nothing to do if it was
      // already quiet.
      if (existingFiring) {
        const resolved = await this.alertsRepository.resolve(existingFiring.id);
        this.logger.info(
          { alertId: resolved.id, serviceId, metricName },
          'Alert auto-resolved on recovery',
        );
        await this.auditLogger.record({
          actorId,
          action: 'alert.auto_resolve',
          entityType: 'Alert',
          entityId: resolved.id,
          metadata: { metricName, value },
        });
        return resolved;
      }
      return null;
    }

    const wasAlreadyFiring = existingFiring !== null;
    const fingerprint = `${serviceId}:${rule.metricName}`;
    const alert = await this.alertsRepository.fireOrUpdate({
      serviceId,
      ruleName: rule.metricName,
      severity,
      fingerprint,
    });

    this.logger.warn({ alertId: alert.id, serviceId, metricName, severity, value }, 'Alert firing');
    await this.auditLogger.record({
      actorId,
      action: wasAlreadyFiring ? 'alert.reclassify' : 'alert.fire',
      entityType: 'Alert',
      entityId: alert.id,
      metadata: { metricName, value, severity },
    });

    // Only the transition into a new firing alert opens an incident — a
    // severity change on an alert that's already open doesn't need a
    // second incident, and an incident commander reclassifying severity
    // is the Incident module's own job from there.
    if (!wasAlreadyFiring && AUTO_INCIDENT_SEVERITIES.has(severity) && !alert.incidentId) {
      const incident = await this.incidentCreator.create(
        {
          title: `${rule.metricName} breached threshold on service`,
          severity,
          primaryServiceId: serviceId,
          alertIds: [alert.id],
        },
        actorId,
        actorRole,
      );
      await this.alertsRepository.linkToIncident(alert.id, incident.id);
      this.logger.info(
        { alertId: alert.id, incidentId: incident.id },
        'Alert auto-created an incident',
      );
      return this.alertsRepository.findById(alert.id) as Promise<Alert>;
    }

    return alert;
  }

  async acknowledge(id: string, actorId: string) {
    const alert = await this.getById(id);
    if (alert.state !== 'FIRING') {
      throw new ValidationError(`Cannot acknowledge an alert that is ${alert.state}, not FIRING`);
    }
    const updated = await this.alertsRepository.acknowledge(id);
    await this.auditLogger.record({
      actorId,
      action: 'alert.acknowledge',
      entityType: 'Alert',
      entityId: id,
    });
    return updated;
  }

  async resolve(id: string, actorId: string) {
    const alert = await this.getById(id);
    if (alert.state === 'RESOLVED') {
      throw new ValidationError('Alert is already resolved');
    }
    const updated = await this.alertsRepository.resolve(id);
    await this.auditLogger.record({
      actorId,
      action: 'alert.resolve',
      entityType: 'Alert',
      entityId: id,
    });
    return updated;
  }
}
