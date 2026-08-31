import type { Logger } from 'pino';
import { NotFoundError } from '../../lib/errors.js';
import type {
  MetricsQuery,
  RecordMetricInput,
  ServiceMetricsRepository,
} from './service-metrics.types.js';
import type { ServicesRepository } from './services.types.js';

/**
 * "Service health metrics" as a use case, distinct from the generic
 * `ServicesService`: recording a metric and reading a health snapshot are
 * things a monitoring pipeline calls constantly, at a much higher rate
 * and different auth profile (a scraper/agent, not necessarily a human)
 * than editing a service's catalog entry.
 */
export class ServiceHealthService {
  constructor(
    private readonly metricsRepository: ServiceMetricsRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly logger: Logger,
  ) {}

  async recordMetric(serviceId: string, input: Omit<RecordMetricInput, 'serviceId'>) {
    await this.assertServiceExists(serviceId);
    const metric = await this.metricsRepository.record({ serviceId, ...input });
    this.logger.debug(
      { serviceId, metricName: input.metricName, value: input.value },
      'Metric recorded',
    );
    return metric;
  }

  async listMetrics(serviceId: string, query: MetricsQuery) {
    await this.assertServiceExists(serviceId);
    return this.metricsRepository.findRecent(serviceId, query);
  }

  /** The current-state rollup a dashboard tile renders: latest value per metric name. */
  async getHealthSnapshot(serviceId: string) {
    const service = await this.assertServiceExists(serviceId);
    const metrics = await this.metricsRepository.findLatestPerMetric(serviceId);
    return { serviceId: service.id, status: service.status, metrics };
  }

  private async assertServiceExists(id: string) {
    const service = await this.servicesRepository.findById(id);
    if (!service) {
      throw new NotFoundError(`Service "${id}" not found`);
    }
    return service;
  }
}
