import type { Metric } from '@prisma/client';
import type {
  LatestMetricSnapshot,
  MetricsQuery,
  RecordMetricInput,
  ServiceMetricsRepository,
} from '../../src/modules/services/service-metrics.types.js';

let idCounter = 0n;

export class FakeServiceMetricsRepository implements ServiceMetricsRepository {
  readonly recorded: RecordMetricInput[] = [];
  recent: Metric[] = [];
  latest: LatestMetricSnapshot[] = [];

  async record(input: RecordMetricInput): Promise<Metric> {
    this.recorded.push(input);
    idCounter += 1n;
    return {
      id: idCounter,
      serviceId: input.serviceId,
      metricName: input.metricName,
      value: input.value,
      unit: input.unit,
      recordedAt: input.recordedAt ?? new Date(),
    };
  }

  async findRecent(): Promise<Metric[]> {
    return this.recent;
  }

  async findLatestPerMetric(): Promise<LatestMetricSnapshot[]> {
    return this.latest;
  }
}

export const defaultMetricsQuery: MetricsQuery = { limit: 100 };
