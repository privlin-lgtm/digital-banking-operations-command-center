import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { FailureSimulatorService } from '../../src/modules/failure-simulator/failure-simulator.service.js';
import { FailureScenarioGenerator } from '../../src/modules/failure-simulator/scenario-generator.js';
import {
  FakeFailureSimulationsRepository,
  FakeMetricEvaluator,
  FakeMetricRecorder,
  FakeServiceLookup,
  makeSimulation,
} from '../fakes/fake-failure-simulator-repository.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('FailureSimulatorService', () => {
  let repository: FakeFailureSimulationsRepository;
  let servicesLookup: FakeServiceLookup;
  let metricRecorder: FakeMetricRecorder;
  let metricEvaluator: FakeMetricEvaluator;
  let auditLogger: FakeAuditLogger;
  let service: FailureSimulatorService;

  beforeEach(() => {
    repository = new FakeFailureSimulationsRepository();
    servicesLookup = new FakeServiceLookup();
    metricRecorder = new FakeMetricRecorder();
    metricEvaluator = new FakeMetricEvaluator();
    auditLogger = new FakeAuditLogger();
    service = new FailureSimulatorService(
      repository,
      servicesLookup,
      metricRecorder,
      metricEvaluator,
      new FailureScenarioGenerator(),
      auditLogger,
      createSilentLogger(),
    );
    servicesLookup.seed('svc-1');
  });

  describe('start', () => {
    it('starts a simulation and records an audit entry', async () => {
      const simulation = await service.start(
        { serviceId: 'svc-1', scenario: 'CPU_SPIKE' },
        'user-1',
      );

      expect(simulation.serviceId).toBe('svc-1');
      expect(simulation.scenario).toBe('CPU_SPIKE');
      expect(simulation.stoppedAt).toBeNull();
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'failure_simulation.start',
        entityId: 'svc-1',
      });
    });

    it('throws NotFoundError for an unknown service', async () => {
      await expect(
        service.start({ serviceId: 'missing', scenario: 'CPU_SPIKE' }, 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('refuses a second concurrent simulation on the same service', async () => {
      await service.start({ serviceId: 'svc-1', scenario: 'CPU_SPIKE' }, 'user-1');
      await expect(
        service.start({ serviceId: 'svc-1', scenario: 'MEMORY_LEAK' }, 'user-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('allows a new simulation once the prior one is stopped', async () => {
      const first = await service.start({ serviceId: 'svc-1', scenario: 'CPU_SPIKE' }, 'user-1');
      await service.stop(first.id, 'user-1');

      await expect(
        service.start({ serviceId: 'svc-1', scenario: 'MEMORY_LEAK' }, 'user-1'),
      ).resolves.toMatchObject({ scenario: 'MEMORY_LEAK' });
    });
  });

  describe('stop', () => {
    it('stops a running simulation and records an audit entry', async () => {
      const simulation = repository.seed(makeSimulation({ serviceId: 'svc-1' }));

      const stopped = await service.stop(simulation.id, 'user-1');

      expect(stopped.stoppedAt).not.toBeNull();
      expect(auditLogger.entries[0]).toMatchObject({
        action: 'failure_simulation.stop',
        entityId: 'svc-1',
      });
    });

    it('rejects stopping an already-stopped simulation', async () => {
      const simulation = repository.seed(
        makeSimulation({ serviceId: 'svc-1', stoppedAt: new Date() }),
      );
      await expect(service.stop(simulation.id, 'user-1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError for an unknown id', async () => {
      await expect(service.stop('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('tick', () => {
    it('feeds every running simulation through record-then-evaluate and advances its tick count', async () => {
      const running = repository.seed(
        makeSimulation({ serviceId: 'svc-1', scenario: 'SERVICE_DEGRADATION', tickCount: 0 }),
      );
      repository.seed(
        makeSimulation({ id: 'sim-stopped', serviceId: 'svc-2', stoppedAt: new Date() }),
      );

      await service.tick('system-user', 'ADMIN');

      // SERVICE_DEGRADATION emits two samples per tick.
      expect(metricRecorder.calls).toHaveLength(2);
      expect(metricRecorder.calls.every((c) => c.serviceId === 'svc-1')).toBe(true);
      expect(metricEvaluator.calls).toHaveLength(2);

      const advanced = await repository.findById(running.id);
      expect(advanced?.tickCount).toBe(1);
    });

    it('does nothing when no simulation is running', async () => {
      await service.tick('system-user', 'ADMIN');
      expect(metricRecorder.calls).toHaveLength(0);
      expect(metricEvaluator.calls).toHaveLength(0);
    });
  });
});
