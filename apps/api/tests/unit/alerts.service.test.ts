import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { AlertsService } from '../../src/modules/alerts/alerts.service.js';
import { ThresholdEvaluator } from '../../src/modules/alerts/threshold-evaluator.js';
import {
  FakeAlertRulesRepository,
  FakeAlertsRepository,
  FakeIncidentCreator,
  makeAlertRule,
} from '../fakes/fake-alerts-repository.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('AlertsService', () => {
  let alertsRepository: FakeAlertsRepository;
  let rulesRepository: FakeAlertRulesRepository;
  let incidentCreator: FakeIncidentCreator;
  let auditLogger: FakeAuditLogger;
  let service: AlertsService;

  beforeEach(() => {
    alertsRepository = new FakeAlertsRepository();
    rulesRepository = new FakeAlertRulesRepository();
    incidentCreator = new FakeIncidentCreator();
    auditLogger = new FakeAuditLogger();
    service = new AlertsService(
      alertsRepository,
      rulesRepository,
      incidentCreator,
      new ThresholdEvaluator(),
      auditLogger,
      createSilentLogger(),
    );
  });

  describe('createRule', () => {
    it('rejects a second rule for the same service and metric', async () => {
      rulesRepository.seed(makeAlertRule({ serviceId: 'svc-1', metricName: 'latency_p99' }));
      await expect(
        service.createRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          comparator: 'GREATER_THAN',
          criticalThreshold: 2000,
          createdById: 'user-1',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('rejects a rule with no thresholds set at all', async () => {
      await expect(
        service.createRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          comparator: 'GREATER_THAN',
          createdById: 'user-1',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('evaluateMetric', () => {
    it('does nothing when no rule is configured for the metric', async () => {
      const result = await service.evaluateMetric(
        'svc-1',
        'unconfigured_metric',
        9999,
        'user-1',
        'ADMIN',
      );
      expect(result).toBeNull();
    });

    it('does nothing for an inactive rule', async () => {
      rulesRepository.seed(
        makeAlertRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          isActive: false,
          criticalThreshold: 100,
        }),
      );
      const result = await service.evaluateMetric('svc-1', 'latency_p99', 9999, 'user-1', 'ADMIN');
      expect(result).toBeNull();
    });

    it('fires a SEV3 alert on a medium breach and does not open an incident', async () => {
      rulesRepository.seed(
        makeAlertRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          criticalThreshold: 2000,
          highThreshold: 1000,
          mediumThreshold: 500,
        }),
      );
      const alert = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        600,
        'user-1',
        'RESPONDER',
      );
      expect(alert).toMatchObject({ severity: 'SEV3', state: 'FIRING' });
      expect(incidentCreator.calls).toHaveLength(0);
    });

    it('fires a SEV1 alert on a critical breach and auto-creates an incident', async () => {
      rulesRepository.seed(
        makeAlertRule({ serviceId: 'svc-1', metricName: 'latency_p99', criticalThreshold: 2000 }),
      );
      const alert = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        5000,
        'user-1',
        'RESPONDER',
      );

      expect(alert?.severity).toBe('SEV1');
      expect(alert?.incidentId).toBe('inc-1');
      expect(incidentCreator.calls).toHaveLength(1);
      expect(incidentCreator.calls[0]).toMatchObject({
        severity: 'SEV1',
        primaryServiceId: 'svc-1',
      });
    });

    it('does not open a second incident when an already-firing alert re-fires', async () => {
      rulesRepository.seed(
        makeAlertRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          criticalThreshold: 2000,
          highThreshold: 1000,
        }),
      );
      await service.evaluateMetric('svc-1', 'latency_p99', 5000, 'user-1', 'RESPONDER'); // fires SEV1, opens incident
      await service.evaluateMetric('svc-1', 'latency_p99', 6000, 'user-1', 'RESPONDER'); // still critical, same alert

      expect(incidentCreator.calls).toHaveLength(1);
    });

    it('auto-resolves a firing alert once the metric recovers', async () => {
      rulesRepository.seed(
        makeAlertRule({
          serviceId: 'svc-1',
          metricName: 'latency_p99',
          criticalThreshold: 2000,
          mediumThreshold: 500,
        }),
      );
      const fired = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        600,
        'user-1',
        'RESPONDER',
      );
      expect(fired?.state).toBe('FIRING');

      const recovered = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        100,
        'user-1',
        'RESPONDER',
      );
      expect(recovered?.state).toBe('RESOLVED');
      expect(auditLogger.entries.some((e) => e.action === 'alert.auto_resolve')).toBe(true);
    });

    it('does nothing on recovery if nothing was firing', async () => {
      rulesRepository.seed(
        makeAlertRule({ serviceId: 'svc-1', metricName: 'latency_p99', criticalThreshold: 2000 }),
      );
      const result = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        10,
        'user-1',
        'RESPONDER',
      );
      expect(result).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('rejects acknowledging a non-firing alert', async () => {
      rulesRepository.seed(
        makeAlertRule({ serviceId: 'svc-1', metricName: 'latency_p99', criticalThreshold: 100 }),
      );
      const alert = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        200,
        'user-1',
        'RESPONDER',
      );
      await service.acknowledge(alert!.id, 'user-1');
      await expect(service.acknowledge(alert!.id, 'user-1')).rejects.toThrow(ValidationError);
    });

    it('rejects resolving an already-resolved alert', async () => {
      rulesRepository.seed(
        makeAlertRule({ serviceId: 'svc-1', metricName: 'latency_p99', criticalThreshold: 100 }),
      );
      const alert = await service.evaluateMetric(
        'svc-1',
        'latency_p99',
        200,
        'user-1',
        'RESPONDER',
      );
      await service.resolve(alert!.id, 'user-1');
      await expect(service.resolve(alert!.id, 'user-1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError for an unknown alert', async () => {
      await expect(service.acknowledge('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });
});
