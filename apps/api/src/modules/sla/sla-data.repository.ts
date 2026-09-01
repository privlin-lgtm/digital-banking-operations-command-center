import type { PrismaClient } from '@prisma/client';
import type { SlaDataSource, SlaWindowData } from './sla.types.js';

/** The metric name treated as this service's "response time" signal — matches what the seed data and the remediation/health modules already use for latency. */
const RESPONSE_TIME_METRIC_NAME = 'latency_p99';

function overlapMinutes(
  spanStart: Date,
  spanEnd: Date,
  windowStart: Date,
  windowEnd: Date,
): number {
  const start = Math.max(spanStart.getTime(), windowStart.getTime());
  const end = Math.min(spanEnd.getTime(), windowEnd.getTime());
  return Math.max(0, end - start) / 60_000;
}

export class PrismaSlaDataSource implements SlaDataSource {
  constructor(private readonly prisma: PrismaClient) {}

  async gatherWindowData(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SlaWindowData> {
    const [downtimeMinutes, responseTimeSamplesMs, detectionGapsMinutes, recoveryTimesMinutes] =
      await Promise.all([
        this.calculateDowntimeMinutes(serviceId, windowStart, windowEnd),
        this.gatherResponseTimeSamples(serviceId, windowStart, windowEnd),
        this.gatherDetectionGaps(serviceId, windowStart, windowEnd),
        this.gatherRecoveryTimes(serviceId, windowStart, windowEnd),
      ]);

    return { downtimeMinutes, responseTimeSamplesMs, detectionGapsMinutes, recoveryTimesMinutes };
  }

  /**
   * Downtime is derived from incident duration against this service, not
   * from a dedicated uptime-check table — this platform doesn't run
   * synthetic probes, so "the service was down" is defined as "there was
   * an open incident against it." An incident still open at windowEnd
   * counts as down through the end of the window, not indefinitely.
   */
  private async calculateDowntimeMinutes(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number> {
    const incidents = await this.prisma.incident.findMany({
      where: {
        primaryServiceId: serviceId,
        openedAt: { lt: windowEnd },
        OR: [{ resolvedAt: null }, { resolvedAt: { gt: windowStart } }],
      },
      select: { openedAt: true, resolvedAt: true },
    });

    return incidents.reduce(
      (total, incident) =>
        total +
        overlapMinutes(incident.openedAt, incident.resolvedAt ?? windowEnd, windowStart, windowEnd),
      0,
    );
  }

  private async gatherResponseTimeSamples(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number[]> {
    const samples = await this.prisma.metric.findMany({
      where: {
        serviceId,
        metricName: RESPONSE_TIME_METRIC_NAME,
        recordedAt: { gte: windowStart, lt: windowEnd },
      },
      select: { value: true },
    });
    return samples.map((sample) => sample.value);
  }

  /**
   * Only incidents with a linked alert contribute — a manually-declared
   * incident has no detection gap to measure. Windowed and measured against
   * `openedAt`, not `createdAt`: `openedAt` is the business timestamp used
   * everywhere else in this file (downtime, recovery), while `createdAt` is
   * Prisma's row-insert audit timestamp — for the seeded six-month history,
   * every row's `createdAt` is really "whenever the seed script ran," not
   * the incident's fictional backdated date, so comparing it against a
   * backdated `firedAt` produced gaps of literal months.
   */
  private async gatherDetectionGaps(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number[]> {
    const incidents = await this.prisma.incident.findMany({
      where: { primaryServiceId: serviceId, openedAt: { gte: windowStart, lt: windowEnd } },
      select: {
        openedAt: true,
        alerts: { select: { firedAt: true }, orderBy: { firedAt: 'asc' }, take: 1 },
      },
    });

    return incidents
      .filter((incident) => incident.alerts.length > 0)
      .map(
        (incident) =>
          (incident.openedAt.getTime() - incident.alerts[0]!.firedAt.getTime()) / 60_000,
      )
      .filter((gap) => gap >= 0);
  }

  private async gatherRecoveryTimes(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number[]> {
    const incidents = await this.prisma.incident.findMany({
      where: { primaryServiceId: serviceId, resolvedAt: { gte: windowStart, lt: windowEnd } },
      select: { openedAt: true, resolvedAt: true },
    });

    return incidents.map(
      (incident) => (incident.resolvedAt!.getTime() - incident.openedAt.getTime()) / 60_000,
    );
  }
}
