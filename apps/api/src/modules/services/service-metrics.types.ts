import type { Metric } from '@prisma/client';

export interface RecordMetricInput {
  serviceId: string;
  metricName: string;
  value: number;
  unit: string;
  recordedAt?: Date | undefined;
}

export interface MetricsQuery {
  metricName?: string | undefined;
  since?: Date | undefined;
  limit: number;
}

/** One row of "the most recent sample for each metric name this service reports". */
export interface LatestMetricSnapshot {
  metricName: string;
  value: number;
  unit: string;
  recordedAt: Date;
}

export interface ServiceMetricsRepository {
  record(input: RecordMetricInput): Promise<Metric>;
  findRecent(serviceId: string, query: MetricsQuery): Promise<Metric[]>;
  /** Latest value per distinct metric name — the data behind a health snapshot. */
  findLatestPerMetric(serviceId: string): Promise<LatestMetricSnapshot[]>;
}
