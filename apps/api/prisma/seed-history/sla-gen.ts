import type { SlaWindow } from '@prisma/client';
import { SlaCalculator, type SlaCalculationResult } from '../../src/modules/sla/sla-calculator.js';
import { HISTORY_DAYS, SERVICES, type ServiceDef } from './config.js';
import type { IncidentSummary } from './incidents-gen.js';
import type { MetricSample } from './metrics-gen.js';
import type { StoryBeat } from './narrative.js';

const TIER_TARGET: Record<string, number> = {
  TIER_1: 99.95,
  TIER_2: 99.9,
  TIER_3: 99.5,
  TIER_4: 99.0,
};

export interface SlaRecordInput extends SlaCalculationResult {
  serviceKey: string;
  windowType: SlaWindow;
  windowStart: Date;
  windowEnd: Date;
  targetPercent: number;
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  return Math.max(0, (e - s) / 60_000);
}

function downtimeMinutesInWindow(
  beats: StoryBeat[],
  serviceKey: string,
  windowStart: number,
  windowEnd: number,
): number {
  let total = 0;
  for (const beat of beats) {
    if (beat.serviceKey !== serviceKey) continue;
    const weight = beat.kind === 'DEGRADED' ? 0.3 : 1;
    total +=
      overlapMinutes(beat.start.getTime(), beat.end.getTime(), windowStart, windowEnd) * weight;
  }
  return total;
}

const calculator = new SlaCalculator();

function buildRecord(
  service: ServiceDef,
  beats: StoryBeat[],
  latencySamples: MetricSample[],
  serviceIncidents: IncidentSummary[],
  windowType: SlaWindow,
  windowStart: Date,
  effectiveEnd: number,
  targetPercent: number,
): SlaRecordInput | null {
  const windowMinutes = (effectiveEnd - windowStart.getTime()) / 60_000;
  if (windowMinutes <= 0) return null;

  const downtime = downtimeMinutesInWindow(beats, service.key, windowStart.getTime(), effectiveEnd);
  const responseSamples = latencySamples
    .filter(
      (s) =>
        s.recordedAt.getTime() >= windowStart.getTime() && s.recordedAt.getTime() < effectiveEnd,
    )
    .map((s) => s.value);
  const detectionGaps = serviceIncidents
    .filter(
      (i) => i.openedAt.getTime() >= windowStart.getTime() && i.openedAt.getTime() < effectiveEnd,
    )
    .map((i) => (i.openedAt.getTime() - i.firstAlertFiredAt.getTime()) / 60_000);
  const recoveryTimes = serviceIncidents
    .filter(
      (i) =>
        i.resolvedAt &&
        i.resolvedAt.getTime() >= windowStart.getTime() &&
        i.resolvedAt.getTime() < effectiveEnd,
    )
    .map((i) => (i.resolvedAt!.getTime() - i.openedAt.getTime()) / 60_000);

  const result = calculator.calculate({
    windowMinutes,
    downtimeMinutes: downtime,
    targetPercent,
    responseTimeSamplesMs: responseSamples,
    detectionGapsMinutes: detectionGaps,
    recoveryTimesMinutes: recoveryTimes,
  });

  return {
    serviceKey: service.key,
    windowType,
    windowStart,
    windowEnd: new Date(effectiveEnd),
    targetPercent,
    ...result,
  };
}

export function generateSlaRecords(
  beats: StoryBeat[],
  metricSamples: MetricSample[],
  incidentSummaries: IncidentSummary[],
  now: Date,
): SlaRecordInput[] {
  const records: SlaRecordInput[] = [];
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - HISTORY_DAYS);
  historyStart.setHours(0, 0, 0, 0);

  const latencyByService = new Map<string, MetricSample[]>();
  for (const sample of metricSamples) {
    if (sample.metricName !== 'p99_latency_ms') continue;
    if (!latencyByService.has(sample.serviceKey)) latencyByService.set(sample.serviceKey, []);
    latencyByService.get(sample.serviceKey)!.push(sample);
  }

  for (const service of SERVICES) {
    const targetPercent = TIER_TARGET[service.tier] ?? 99.9;
    const latencySamples = latencyByService.get(service.key) ?? [];
    const serviceIncidents = incidentSummaries.filter((i) => i.serviceKey === service.key);

    for (let d = 0; d < HISTORY_DAYS; d += 1) {
      const windowStart = new Date(historyStart);
      windowStart.setDate(windowStart.getDate() + d);
      if (windowStart.getTime() > now.getTime()) break;
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);
      const record = buildRecord(
        service,
        beats,
        latencySamples,
        serviceIncidents,
        'DAILY',
        windowStart,
        Math.min(windowEnd.getTime(), now.getTime()),
        targetPercent,
      );
      if (record) records.push(record);
    }

    for (let w = 0; w * 7 < HISTORY_DAYS; w += 1) {
      const windowStart = new Date(historyStart);
      windowStart.setDate(windowStart.getDate() + w * 7);
      if (windowStart.getTime() > now.getTime()) break;
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 7);
      const record = buildRecord(
        service,
        beats,
        latencySamples,
        serviceIncidents,
        'WEEKLY',
        windowStart,
        Math.min(windowEnd.getTime(), now.getTime()),
        targetPercent,
      );
      if (record) records.push(record);
    }

    let monthCursor = new Date(historyStart.getFullYear(), historyStart.getMonth(), 1);
    while (monthCursor.getTime() < now.getTime()) {
      const windowStart = new Date(Math.max(monthCursor.getTime(), historyStart.getTime()));
      const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      const record = buildRecord(
        service,
        beats,
        latencySamples,
        serviceIncidents,
        'MONTHLY',
        windowStart,
        Math.min(nextMonth.getTime(), now.getTime()),
        targetPercent,
      );
      if (record) records.push(record);
      monthCursor = nextMonth;
    }
  }

  return records;
}
