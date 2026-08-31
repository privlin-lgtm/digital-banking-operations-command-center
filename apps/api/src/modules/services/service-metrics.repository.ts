import type { Metric, PrismaClient } from '@prisma/client';
import type {
  LatestMetricSnapshot,
  MetricsQuery,
  RecordMetricInput,
  ServiceMetricsRepository,
} from './service-metrics.types.js';

export class PrismaServiceMetricsRepository implements ServiceMetricsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  record(input: RecordMetricInput): Promise<Metric> {
    return this.prisma.metric.create({
      data: {
        serviceId: input.serviceId,
        metricName: input.metricName,
        value: input.value,
        unit: input.unit,
        recordedAt: input.recordedAt ?? new Date(),
      },
    });
  }

  findRecent(serviceId: string, query: MetricsQuery): Promise<Metric[]> {
    return this.prisma.metric.findMany({
      where: {
        serviceId,
        ...(query.metricName ? { metricName: query.metricName } : {}),
        ...(query.since ? { recordedAt: { gte: query.since } } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: query.limit,
    });
  }

  /**
   * `DISTINCT ON` is the idiomatic Postgres way to get "the latest row per
   * group" in a single index-friendly scan — the alternative (a
   * correlated subquery or window function per metric name from
   * application code) means one round trip per metric instead of one
   * query total. This is exactly the query-optimization trade-off called
   * out for this table in the database design docs.
   */
  findLatestPerMetric(serviceId: string): Promise<LatestMetricSnapshot[]> {
    return this.prisma.$queryRaw<LatestMetricSnapshot[]>`
      SELECT DISTINCT ON ("metricName") "metricName", "value", "unit", "recordedAt"
      FROM "metrics"
      WHERE "serviceId" = ${serviceId}
      ORDER BY "metricName", "recordedAt" DESC
    `;
  }
}
