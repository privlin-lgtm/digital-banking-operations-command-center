import type { PrismaClient, SlaRecord, SlaWindow } from '@prisma/client';
import type { SlaRecordsRepository, UpsertSlaRecordInput } from './sla.types.js';

export class PrismaSlaRecordsRepository implements SlaRecordsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsert(input: UpsertSlaRecordInput): Promise<SlaRecord> {
    const data = {
      windowEnd: input.windowEnd,
      targetPercent: input.targetPercent,
      actualPercent: input.actualPercent,
      errorBudgetMinutes: input.errorBudgetMinutes,
      errorBudgetConsumedMinutes: input.errorBudgetConsumedMinutes,
      breached: input.breached,
      avgResponseTimeMs: input.avgResponseTimeMs,
      meanTimeToDetectMinutes: input.meanTimeToDetectMinutes,
      meanTimeToRecoverMinutes: input.meanTimeToRecoverMinutes,
      calculatedAt: new Date(),
    };

    return this.prisma.slaRecord.upsert({
      where: {
        serviceId_windowType_windowStart: {
          serviceId: input.serviceId,
          windowType: input.windowType,
          windowStart: input.windowStart,
        },
      },
      update: data,
      create: {
        serviceId: input.serviceId,
        windowType: input.windowType,
        windowStart: input.windowStart,
        ...data,
      },
    });
  }

  findLatest(serviceId: string, windowType: SlaWindow): Promise<SlaRecord | null> {
    return this.prisma.slaRecord.findFirst({
      where: { serviceId, windowType },
      orderBy: { windowStart: 'desc' },
    });
  }

  findHistory(serviceId: string, windowType: SlaWindow, limit: number): Promise<SlaRecord[]> {
    return this.prisma.slaRecord.findMany({
      where: { serviceId, windowType },
      orderBy: { windowStart: 'desc' },
      take: limit,
    });
  }

  /**
   * "Current" = the latest window per service for this window type — a
   * plain `where: { breached: true }` would also surface old, superseded
   * windows once a service has more than one row. `DISTINCT ON` picks
   * the most recent row per service in one indexed scan, the same
   * pattern used for "latest metric per name" elsewhere in this codebase.
   */
  async findCurrentBreaches(windowType: SlaWindow): Promise<SlaRecord[]> {
    // The explicit ::"SlaWindow" cast matters: Prisma parameterizes the
    // interpolated value as `text`, and Postgres has no `=` operator
    // between an enum column and a plain text literal — without the
    // cast this fails at query time with a 42883 "operator does not
    // exist" error.
    const latestIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON ("serviceId") "id"
      FROM "sla_records"
      WHERE "windowType" = ${windowType}::"SlaWindow"
      ORDER BY "serviceId", "windowStart" DESC
    `;

    if (latestIds.length === 0) {
      return [];
    }

    return this.prisma.slaRecord.findMany({
      where: { id: { in: latestIds.map((row) => row.id) }, breached: true },
      include: { service: { select: { id: true, name: true, slug: true } } },
      orderBy: { actualPercent: 'asc' },
    });
  }
}
