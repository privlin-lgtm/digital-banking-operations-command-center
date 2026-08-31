import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/lib/errors.js';
import { SlaCalculator } from '../../src/modules/sla/sla-calculator.js';
import { SlaTrackingService } from '../../src/modules/sla/sla.service.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { FakeSlaDataSource, FakeSlaRecordsRepository } from '../fakes/fake-sla-repositories.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('SlaTrackingService', () => {
  let dataSource: FakeSlaDataSource;
  let recordsRepository: FakeSlaRecordsRepository;
  let servicesRepository: FakeServicesRepository;
  let auditLogger: FakeAuditLogger;
  let service: SlaTrackingService;

  beforeEach(() => {
    dataSource = new FakeSlaDataSource();
    recordsRepository = new FakeSlaRecordsRepository();
    servicesRepository = new FakeServicesRepository();
    auditLogger = new FakeAuditLogger();
    service = new SlaTrackingService(
      dataSource,
      recordsRepository,
      servicesRepository,
      new SlaCalculator(),
      auditLogger,
      createSilentLogger(),
    );
  });

  describe('calculateForService', () => {
    it('throws NotFoundError for an unknown service', async () => {
      await expect(
        service.calculateForService(
          'missing',
          'MONTHLY',
          new Date('2026-01-01'),
          new Date('2026-02-01'),
          99.9,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('persists the calculated record and audits it when an actor is given', async () => {
      const svc = servicesRepository.seed(makeService());
      dataSource.windowData = {
        downtimeMinutes: 5,
        responseTimeSamplesMs: [120, 140],
        detectionGapsMinutes: [3],
        recoveryTimesMinutes: [20],
      };

      const record = await service.calculateForService(
        svc.id,
        'MONTHLY',
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-02-01T00:00:00Z'),
        99.9,
        'user-1',
      );

      expect(record.serviceId).toBe(svc.id);
      expect(record.breached).toBe(false); // 5 minutes of downtime over a month is well within a 99.9% budget
      expect(auditLogger.entries[0]).toMatchObject({ action: 'sla.calculate', entityId: svc.id });
    });

    it('does not audit when no actor is given (the internal scheduler resolves its own system actor before calling in)', async () => {
      const svc = servicesRepository.seed(makeService());
      await service.calculateForService(
        svc.id,
        'MONTHLY',
        new Date('2026-01-01'),
        new Date('2026-02-01'),
        99.9,
      );
      expect(auditLogger.entries).toHaveLength(0);
    });
  });

  describe('runRollup', () => {
    it('calculates the current month for every service and counts breaches', async () => {
      servicesRepository.seed(makeService({ id: 'svc-a' }));
      servicesRepository.seed(makeService({ id: 'svc-b' }));

      // A month's worth of downtime — guaranteed to breach any reasonable target.
      dataSource.windowData = {
        downtimeMinutes: 100_000,
        responseTimeSamplesMs: [],
        detectionGapsMinutes: [],
        recoveryTimesMinutes: [],
      };

      const result = await service.runRollup('system-actor', 99.9);

      expect(result.processed).toBe(2);
      expect(result.breaches).toBe(2);
      expect(dataSource.calls).toHaveLength(2);
      expect(await recordsRepository.findLatest('svc-a', 'MONTHLY')).toMatchObject({
        breached: true,
      });
    });
  });

  describe('reads', () => {
    it('returns the latest and historical records for a service', async () => {
      const svc = servicesRepository.seed(makeService());
      await service.calculateForService(
        svc.id,
        'MONTHLY',
        new Date('2025-12-01'),
        new Date('2026-01-01'),
        99.9,
      );
      await service.calculateForService(
        svc.id,
        'MONTHLY',
        new Date('2026-01-01'),
        new Date('2026-02-01'),
        99.9,
      );

      const latest = await service.getLatest(svc.id, 'MONTHLY');
      expect(latest?.windowStart).toEqual(new Date('2026-01-01'));

      const history = await service.getHistory(svc.id, 'MONTHLY', 10);
      expect(history).toHaveLength(2);
    });
  });
});
