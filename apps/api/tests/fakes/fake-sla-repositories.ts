import type { SlaRecord, SlaWindow } from '@prisma/client';
import type {
  SlaDataSource,
  SlaRecordsRepository,
  SlaWindowData,
  UpsertSlaRecordInput,
} from '../../src/modules/sla/sla.types.js';

export class FakeSlaDataSource implements SlaDataSource {
  windowData: SlaWindowData = {
    downtimeMinutes: 0,
    responseTimeSamplesMs: [],
    detectionGapsMinutes: [],
    recoveryTimesMinutes: [],
  };

  readonly calls: Array<{ serviceId: string; windowStart: Date; windowEnd: Date }> = [];

  async gatherWindowData(
    serviceId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SlaWindowData> {
    this.calls.push({ serviceId, windowStart, windowEnd });
    return this.windowData;
  }
}

let idCounter = 0;

export class FakeSlaRecordsRepository implements SlaRecordsRepository {
  private readonly rows = new Map<string, SlaRecord>();

  async upsert(input: UpsertSlaRecordInput): Promise<SlaRecord> {
    const key = `${input.serviceId}:${input.windowType}:${input.windowStart.toISOString()}`;
    idCounter += 1;
    const record: SlaRecord = {
      id: this.rows.get(key)?.id ?? `sla-${idCounter}`,
      serviceId: input.serviceId,
      windowType: input.windowType,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      targetPercent: input.targetPercent as unknown as SlaRecord['targetPercent'],
      actualPercent: input.actualPercent as unknown as SlaRecord['actualPercent'],
      errorBudgetMinutes: input.errorBudgetMinutes as unknown as SlaRecord['errorBudgetMinutes'],
      errorBudgetConsumedMinutes:
        input.errorBudgetConsumedMinutes as unknown as SlaRecord['errorBudgetConsumedMinutes'],
      avgResponseTimeMs: input.avgResponseTimeMs as unknown as SlaRecord['avgResponseTimeMs'],
      meanTimeToDetectMinutes:
        input.meanTimeToDetectMinutes as unknown as SlaRecord['meanTimeToDetectMinutes'],
      meanTimeToRecoverMinutes:
        input.meanTimeToRecoverMinutes as unknown as SlaRecord['meanTimeToRecoverMinutes'],
      breached: input.breached,
      calculatedAt: new Date(),
    };
    this.rows.set(key, record);
    return record;
  }

  async findLatest(serviceId: string, windowType: SlaWindow): Promise<SlaRecord | null> {
    const matches = [...this.rows.values()]
      .filter((row) => row.serviceId === serviceId && row.windowType === windowType)
      .sort((a, b) => b.windowStart.getTime() - a.windowStart.getTime());
    return matches[0] ?? null;
  }

  async findHistory(serviceId: string, windowType: SlaWindow, limit: number): Promise<SlaRecord[]> {
    return [...this.rows.values()]
      .filter((row) => row.serviceId === serviceId && row.windowType === windowType)
      .sort((a, b) => b.windowStart.getTime() - a.windowStart.getTime())
      .slice(0, limit);
  }

  async findCurrentBreaches(windowType: SlaWindow): Promise<SlaRecord[]> {
    return [...this.rows.values()].filter((row) => row.windowType === windowType && row.breached);
  }
}
