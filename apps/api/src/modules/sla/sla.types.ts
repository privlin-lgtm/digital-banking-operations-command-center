import type { SlaRecord, SlaWindow } from '@prisma/client';

export interface SlaWindowData {
  downtimeMinutes: number;
  responseTimeSamplesMs: number[];
  detectionGapsMinutes: number[];
  recoveryTimesMinutes: number[];
}

/** Gathers the raw numbers SlaCalculator needs for one service's window — the I/O side of SLA tracking, kept separate from the arithmetic. */
export interface SlaDataSource {
  gatherWindowData(serviceId: string, windowStart: Date, windowEnd: Date): Promise<SlaWindowData>;
}

export interface UpsertSlaRecordInput {
  serviceId: string;
  windowType: SlaWindow;
  windowStart: Date;
  windowEnd: Date;
  targetPercent: number;
  actualPercent: number;
  errorBudgetMinutes: number;
  errorBudgetConsumedMinutes: number;
  breached: boolean;
  avgResponseTimeMs: number | null;
  meanTimeToDetectMinutes: number | null;
  meanTimeToRecoverMinutes: number | null;
}

export interface SlaRecordsRepository {
  /** One record per (service, windowType, windowStart) — recomputing the same window updates it in place. */
  upsert(input: UpsertSlaRecordInput): Promise<SlaRecord>;
  findLatest(serviceId: string, windowType: SlaWindow): Promise<SlaRecord | null>;
  findHistory(serviceId: string, windowType: SlaWindow, limit: number): Promise<SlaRecord[]>;
  findCurrentBreaches(windowType: SlaWindow): Promise<SlaRecord[]>;
}
