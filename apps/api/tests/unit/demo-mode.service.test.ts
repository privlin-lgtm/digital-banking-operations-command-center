import type { Alert } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/lib/errors.js';
import { DemoModeService } from '../../src/modules/demo-mode/demo-mode.service.js';
import { DEMO_SCENARIO_DEFS } from '../../src/modules/demo-mode/demo-scenarios.js';
import {
  FakeDemoIncidentLifecycle,
  FakeDemoMetricEvaluator,
  FakeDemoMetricRecorder,
  FakeDemoModeRepository,
  FakeDemoRcaLifecycle,
  FakeDemoReviewerLookup,
  FakeDemoServiceLookup,
  FakeDemoSlaRollupTrigger,
} from '../fakes/fake-demo-mode-repository.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

let alertCounter = 0;
function makeAlert(overrides: Partial<Alert> = {}): Alert {
  alertCounter += 1;
  const now = new Date();
  return {
    id: overrides.id ?? `alert-${alertCounter}`,
    serviceId: overrides.serviceId ?? 'svc-core-banking',
    incidentId: overrides.incidentId ?? null,
    ruleName: overrides.ruleName ?? 'db_connection_pool_used_percent',
    severity: overrides.severity ?? 'SEV1',
    state: overrides.state ?? 'FIRING',
    fingerprint: overrides.fingerprint ?? 'svc-core-banking:db_connection_pool_used_percent',
    firedAt: overrides.firedAt ?? now,
    resolvedAt: overrides.resolvedAt ?? null,
    createdAt: overrides.createdAt ?? now,
  };
}

const DB_OUTAGE = DEMO_SCENARIO_DEFS.DATABASE_OUTAGE;

describe('DemoModeService', () => {
  let repository: FakeDemoModeRepository;
  let serviceLookup: FakeDemoServiceLookup;
  let metricRecorder: FakeDemoMetricRecorder;
  let metricEvaluator: FakeDemoMetricEvaluator;
  let incidents: FakeDemoIncidentLifecycle;
  let sla: FakeDemoSlaRollupTrigger;
  let rca: FakeDemoRcaLifecycle;
  let reviewerLookup: FakeDemoReviewerLookup;
  let service: DemoModeService;

  beforeEach(() => {
    repository = new FakeDemoModeRepository();
    serviceLookup = new FakeDemoServiceLookup();
    serviceLookup.seed(DB_OUTAGE.serviceSlug, 'svc-core-banking');
    metricRecorder = new FakeDemoMetricRecorder();
    metricEvaluator = new FakeDemoMetricEvaluator();
    incidents = new FakeDemoIncidentLifecycle();
    sla = new FakeDemoSlaRollupTrigger();
    rca = new FakeDemoRcaLifecycle();
    reviewerLookup = new FakeDemoReviewerLookup();
    service = new DemoModeService(
      repository,
      serviceLookup,
      metricRecorder,
      metricEvaluator,
      incidents,
      sla,
      rca,
      reviewerLookup,
      new FakeAuditLogger(),
      createSilentLogger(),
      () => 0.5,
    );
  });

  describe('enable', () => {
    it('rejects a scenario whose target service does not exist', async () => {
      serviceLookup = new FakeDemoServiceLookup(); // empty — nothing seeded
      service = new DemoModeService(
        repository,
        serviceLookup,
        metricRecorder,
        metricEvaluator,
        incidents,
        sla,
        rca,
        reviewerLookup,
        new FakeAuditLogger(),
        createSilentLogger(),
      );
      await expect(service.enable({ scenario: 'DATABASE_OUTAGE' }, 'actor-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('starts a fresh run in BASELINE against the scenario’s real service', async () => {
      const state = await service.enable({ scenario: 'DATABASE_OUTAGE' }, 'actor-1');
      expect(state.enabled).toBe(true);
      expect(state.scenario).toBe('DATABASE_OUTAGE');
      expect(state.serviceId).toBe('svc-core-banking');
      expect(state.phase).toBe('BASELINE');
      expect(state.ticksInPhase).toBe(0);
      expect(state.phaseTargetTicks).toBeGreaterThan(0);
    });
  });

  it('does nothing when disabled', async () => {
    repository.seed({ enabled: false, phase: 'BASELINE' });
    await service.tick('actor-1', 'ADMIN');
    expect(metricRecorder.calls).toHaveLength(0);
  });

  it('advances BASELINE to DEGRADING once its tick budget is spent', async () => {
    repository.seed({
      enabled: true,
      phase: 'BASELINE',
      scenario: 'DATABASE_OUTAGE',
      serviceId: 'svc-core-banking',
      ticksInPhase: 0,
      phaseTargetTicks: 1,
    });
    await service.tick('actor-1', 'ADMIN');
    const state = await service.getState();
    expect(state.phase).toBe('DEGRADING');
    expect(metricRecorder.calls.some((c) => c.metricName === DB_OUTAGE.primary.metricName)).toBe(
      true,
    );
  });

  describe('DEGRADING', () => {
    it('stays DEGRADING while the primary metric has not bred an incident', async () => {
      repository.seed({
        enabled: true,
        phase: 'DEGRADING',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        ticksInPhase: 0,
        phaseTargetTicks: 5,
      });
      metricEvaluator.respond = () => null;
      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('DEGRADING');
      expect(state.ticksInPhase).toBe(1);
    });

    it('transitions to INCIDENT the moment the primary metric fires a SEV1 that opens an incident', async () => {
      repository.seed({
        enabled: true,
        phase: 'DEGRADING',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        ticksInPhase: 3,
        phaseTargetTicks: 4,
      });
      metricEvaluator.respond = (_svc, metricName) =>
        metricName === DB_OUTAGE.primary.metricName
          ? makeAlert({ id: 'alert-breach', incidentId: 'incident-1', severity: 'SEV1' })
          : null;

      await service.tick('actor-1', 'ADMIN');

      const state = await service.getState();
      expect(state.phase).toBe('INCIDENT');
      expect(state.incidentId).toBe('incident-1');
      expect(state.alertId).toBe('alert-breach');
      expect(incidents.acknowledged).toEqual(['incident-1']);
    });

    it('still transitions to INCIDENT even if acknowledging fails (a human may have already acted)', async () => {
      incidents.acknowledgeShouldThrow = true;
      repository.seed({
        enabled: true,
        phase: 'DEGRADING',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        ticksInPhase: 3,
        phaseTargetTicks: 4,
      });
      metricEvaluator.respond = (_svc, metricName) =>
        metricName === DB_OUTAGE.primary.metricName
          ? makeAlert({ id: 'alert-breach', incidentId: 'incident-1', severity: 'SEV1' })
          : null;

      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('INCIDENT');
    });
  });

  it('moves INCIDENT to REMEDIATING and mitigates the incident once its hold budget is spent', async () => {
    repository.seed({
      enabled: true,
      phase: 'INCIDENT',
      scenario: 'DATABASE_OUTAGE',
      serviceId: 'svc-core-banking',
      incidentId: 'incident-1',
      alertId: 'alert-breach',
      ticksInPhase: 0,
      phaseTargetTicks: 1,
    });
    await service.tick('actor-1', 'ADMIN');
    const state = await service.getState();
    expect(state.phase).toBe('REMEDIATING');
    expect(incidents.mitigated).toEqual(['incident-1']);
  });

  describe('REMEDIATING', () => {
    it('moves to RESOLVED as soon as the original alert auto-resolves, even mid-budget', async () => {
      repository.seed({
        enabled: true,
        phase: 'REMEDIATING',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        incidentId: 'incident-1',
        alertId: 'alert-breach',
        ticksInPhase: 0,
        phaseTargetTicks: 6,
      });
      metricEvaluator.respond = (_svc, metricName) =>
        metricName === DB_OUTAGE.primary.metricName
          ? makeAlert({ id: 'alert-breach', state: 'RESOLVED' })
          : null;

      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('RESOLVED');
    });

    it('force-resolves on the final tick even without an explicit auto-resolve signal', async () => {
      repository.seed({
        enabled: true,
        phase: 'REMEDIATING',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        incidentId: 'incident-1',
        alertId: 'alert-breach',
        ticksInPhase: 0,
        phaseTargetTicks: 1,
      });
      metricEvaluator.respond = () => null;
      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('RESOLVED');
    });
  });

  it('resolves the incident and runs an SLA rollup, then moves to RCA_REVIEW', async () => {
    repository.seed({
      enabled: true,
      phase: 'RESOLVED',
      scenario: 'DATABASE_OUTAGE',
      serviceId: 'svc-core-banking',
      incidentId: 'incident-1',
      ticksInPhase: 0,
      phaseTargetTicks: 1,
    });
    await service.tick('actor-1', 'ADMIN');
    expect(incidents.resolved).toHaveLength(1);
    expect(incidents.resolved[0]?.id).toBe('incident-1');
    expect(sla.calls).toEqual(['actor-1']);
    const state = await service.getState();
    expect(state.phase).toBe('RCA_REVIEW');
  });

  it('drafts, submits, and approves an RCA report with a reviewer distinct from the author', async () => {
    repository.seed({
      enabled: true,
      phase: 'RCA_REVIEW',
      scenario: 'DATABASE_OUTAGE',
      serviceId: 'svc-core-banking',
      incidentId: 'incident-1',
      ticksInPhase: 0,
      phaseTargetTicks: 1,
    });
    await service.tick('author-actor', 'ADMIN');

    expect(rca.created).toEqual([{ incidentId: 'incident-1', authoredById: 'author-actor' }]);
    expect(rca.submitted).toEqual(['rca-1']);
    expect(rca.approved).toEqual([{ id: 'rca-1', reviewedById: 'reviewer-1' }]);
    const state = await service.getState();
    expect(state.phase).toBe('COOLDOWN');
    expect(state.rcaReportId).toBe('rca-1');
  });

  it('leaves the RCA IN_REVIEW (never self-approved) when no distinct reviewer exists', async () => {
    reviewerLookup.candidate = null;
    repository.seed({
      enabled: true,
      phase: 'RCA_REVIEW',
      scenario: 'DATABASE_OUTAGE',
      serviceId: 'svc-core-banking',
      incidentId: 'incident-1',
      ticksInPhase: 0,
      phaseTargetTicks: 1,
    });
    await service.tick('author-actor', 'ADMIN');
    expect(rca.approved).toHaveLength(0);
  });

  describe('COOLDOWN', () => {
    it('auto-loops into a different scenario when autoLoop is on', async () => {
      serviceLookup.seed(DEMO_SCENARIO_DEFS.THIRD_PARTY_OUTAGE.serviceSlug, 'svc-payments');
      serviceLookup.seed(DEMO_SCENARIO_DEFS.DEPENDENCY_FAILURE.serviceSlug, 'svc-auth');
      serviceLookup.seed(DEMO_SCENARIO_DEFS.LATENCY_SPIKE.serviceSlug, 'svc-mobile');
      serviceLookup.seed(DEMO_SCENARIO_DEFS.DEPLOYMENT_FAILURE.serviceSlug, 'svc-cards');
      serviceLookup.seed(DEMO_SCENARIO_DEFS.MEMORY_LEAK.serviceSlug, 'svc-notify');
      repository.seed({
        enabled: true,
        autoLoop: true,
        phase: 'COOLDOWN',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        ticksInPhase: 0,
        phaseTargetTicks: 1,
      });
      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('BASELINE');
      expect(state.scenario).not.toBe('DATABASE_OUTAGE');
      expect(state.lastScenario).toBe('DATABASE_OUTAGE');
    });

    it('goes IDLE instead of looping when autoLoop is off', async () => {
      repository.seed({
        enabled: true,
        autoLoop: false,
        phase: 'COOLDOWN',
        scenario: 'DATABASE_OUTAGE',
        serviceId: 'svc-core-banking',
        ticksInPhase: 0,
        phaseTargetTicks: 1,
      });
      await service.tick('actor-1', 'ADMIN');
      const state = await service.getState();
      expect(state.phase).toBe('IDLE');
    });
  });

  it('disable turns the run off and parks it in IDLE', async () => {
    repository.seed({ enabled: true, phase: 'DEGRADING' });
    const state = await service.disable('actor-1');
    expect(state.enabled).toBe(false);
    expect(state.phase).toBe('IDLE');
  });
});
