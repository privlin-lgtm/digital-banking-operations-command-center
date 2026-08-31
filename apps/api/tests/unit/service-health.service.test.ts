import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/lib/errors.js';
import { ServiceHealthService } from '../../src/modules/services/service-metrics.service.js';
import {
  defaultMetricsQuery,
  FakeServiceMetricsRepository,
} from '../fakes/fake-service-metrics-repository.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

describe('ServiceHealthService', () => {
  let metricsRepository: FakeServiceMetricsRepository;
  let servicesRepository: FakeServicesRepository;
  let healthService: ServiceHealthService;

  beforeEach(() => {
    metricsRepository = new FakeServiceMetricsRepository();
    servicesRepository = new FakeServicesRepository();
    healthService = new ServiceHealthService(
      metricsRepository,
      servicesRepository,
      createSilentLogger(),
    );
  });

  describe('recordMetric', () => {
    it('throws NotFoundError when the service does not exist', async () => {
      await expect(
        healthService.recordMetric('missing', {
          metricName: 'availability',
          value: 99.9,
          unit: 'percent',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('records the metric against the service', async () => {
      const svc = servicesRepository.seed(makeService());

      const metric = await healthService.recordMetric(svc.id, {
        metricName: 'availability',
        value: 99.95,
        unit: 'percent',
      });

      expect(metric).toMatchObject({ serviceId: svc.id, metricName: 'availability', value: 99.95 });
      expect(metricsRepository.recorded).toHaveLength(1);
    });
  });

  describe('listMetrics', () => {
    it('throws NotFoundError when the service does not exist', async () => {
      await expect(healthService.listMetrics('missing', defaultMetricsQuery)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('returns whatever the repository has for an existing service', async () => {
      const svc = servicesRepository.seed(makeService());
      metricsRepository.recent = [
        {
          id: 1n,
          serviceId: svc.id,
          metricName: 'latency_p99',
          value: 120,
          unit: 'ms',
          recordedAt: new Date(),
        },
      ];

      await expect(healthService.listMetrics(svc.id, defaultMetricsQuery)).resolves.toEqual(
        metricsRepository.recent,
      );
    });
  });

  describe('getHealthSnapshot', () => {
    it('combines the service status with the latest-per-metric rollup', async () => {
      const svc = servicesRepository.seed(makeService({ status: 'DEGRADED' }));
      metricsRepository.latest = [
        { metricName: 'availability', value: 98.4, unit: 'percent', recordedAt: new Date() },
      ];

      const snapshot = await healthService.getHealthSnapshot(svc.id);

      expect(snapshot).toEqual({
        serviceId: svc.id,
        status: 'DEGRADED',
        metrics: metricsRepository.latest,
      });
    });

    it('throws NotFoundError when the service does not exist', async () => {
      await expect(healthService.getHealthSnapshot('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
