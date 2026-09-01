import type { Severity } from '@prisma/client';
import { ARCHETYPES, HISTORY_DAYS, SERVICES, type ArchetypeKey } from './config.js';
import { chance, pick, randInt, type Rng } from './rng.js';

export interface StoryBeat {
  id: string;
  serviceKey: string;
  archetype: ArchetypeKey;
  severity: Severity;
  kind: 'INCIDENT' | 'DEGRADED';
  start: Date;
  end: Date;
  flagship: boolean;
  cascadeTo: string[];
  inProgress: boolean;
  triggerVariant: string;
  vendor?: string | undefined;
  /** MEMORY_LEAK only: hours before `start` the slow climb actually began. */
  rampHours?: number | undefined;
}

const THIRD_PARTY_ELIGIBLE: Record<string, string> = {
  'payments-gateway': "the correspondent banking network's settlement API",
  'card-processing': "the card network's authorization endpoint",
  'notification-service': 'the SMS delivery provider',
  'kyc-service': "the identity-verification vendor's document-check API",
};

const DB_OUTAGE_ELIGIBLE = SERVICES.filter((s) =>
  s.metrics.includes('db_connection_pool_used_percent'),
).map((s) => s.key);
const MEMORY_LEAK_ELIGIBLE = SERVICES.filter((s) =>
  s.metrics.includes('memory_utilization_percent'),
).map((s) => s.key);
const LATENCY_ELIGIBLE = SERVICES.filter((s) => s.metrics.includes('p99_latency_ms')).map(
  (s) => s.key,
);
const DEPLOY_ELIGIBLE = SERVICES.map((s) => s.key);
const DEPENDENCY_ORIGINS = SERVICES.filter((s) =>
  SERVICES.some((dep) => dep.dependsOn.some((d) => d.key === s.key)),
).map((s) => s.key);

const DB_OUTAGE_TRIGGERS = [
  'a long-running analytics query left idle transactions open',
  'a connection leak in the newest release went undetected in staging',
  'the automated failover to the standby replica did not complete cleanly',
];
const DEPENDENCY_TRIGGERS = [
  'a bad configuration push disabled request caching',
  'a downstream TLS certificate silently expired',
  'a noisy-neighbor batch job saturated the shared connection pool',
];
const LATENCY_TRIGGERS = [
  'the month-end batch settlement window',
  'a marketing push-notification campaign',
  'a retry storm from a downstream timeout',
];
const DEPLOY_TRIGGERS = [
  'a null-check regression in the request-validation middleware',
  'a misconfigured feature flag that defaulted to an unvalidated code path',
  'a reduced database connection-pool size in the new deployment manifest',
];
const MEMORY_LEAK_TRIGGERS = [
  'connection objects not released after each request',
  'an in-memory cache with no eviction policy',
  'a listener registered on every request without being deregistered',
];

function severityDurationMinutes(rng: Rng, severity: Severity): number {
  switch (severity) {
    case 'SEV1':
      return randInt(rng, 60, 180);
    case 'SEV2':
      return randInt(rng, 45, 150);
    case 'SEV3':
      return randInt(rng, 20, 90);
    case 'SEV4':
      return randInt(rng, 10, 45);
  }
}

function dayOffsetToDate(now: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - (HISTORY_DAYS - dayOffset));
  d.setHours(hour, minute, 0, 0);
  return d;
}

function businessHourTimestamp(rng: Rng, now: Date, dayOffset: number): Date {
  return dayOffsetToDate(now, dayOffset, randInt(rng, 9, 17), randInt(rng, 0, 59));
}

function anyHourTimestamp(rng: Rng, now: Date, dayOffset: number): Date {
  return dayOffsetToDate(now, dayOffset, randInt(rng, 0, 23), randInt(rng, 0, 59));
}

function pickTrigger(rng: Rng, archetype: ArchetypeKey): string {
  switch (archetype) {
    case 'DATABASE_OUTAGE':
      return pick(rng, DB_OUTAGE_TRIGGERS);
    case 'DEPENDENCY_FAILURE':
      return pick(rng, DEPENDENCY_TRIGGERS);
    case 'LATENCY_SPIKE':
      return pick(rng, LATENCY_TRIGGERS);
    case 'DEPLOYMENT_FAILURE':
      return pick(rng, DEPLOY_TRIGGERS);
    case 'MEMORY_LEAK':
      return pick(rng, MEMORY_LEAK_TRIGGERS);
    case 'THIRD_PARTY_OUTAGE':
      return '';
  }
}

function buildBeat(
  rng: Rng,
  now: Date,
  opts: {
    id: string;
    serviceKey: string;
    archetype: ArchetypeKey;
    severity: Severity;
    dayOffset: number;
    businessHours: boolean;
    flagship: boolean;
    cascadeTo?: string[];
    inProgress?: boolean;
  },
): StoryBeat {
  const start = opts.businessHours
    ? businessHourTimestamp(rng, now, opts.dayOffset)
    : anyHourTimestamp(rng, now, opts.dayOffset);
  const durationMin = opts.inProgress
    ? Math.round((now.getTime() - start.getTime()) / 60_000)
    : severityDurationMinutes(rng, opts.severity);
  const end = opts.inProgress ? now : new Date(start.getTime() + durationMin * 60_000);
  const archetype = ARCHETYPES[opts.archetype];

  return {
    id: opts.id,
    serviceKey: opts.serviceKey,
    archetype: opts.archetype,
    severity: opts.severity,
    kind: 'INCIDENT',
    start,
    end,
    flagship: opts.flagship,
    cascadeTo: opts.cascadeTo ?? [],
    inProgress: opts.inProgress ?? false,
    triggerVariant: pickTrigger(rng, opts.archetype),
    vendor:
      archetype.key === 'THIRD_PARTY_OUTAGE' ? THIRD_PARTY_ELIGIBLE[opts.serviceKey] : undefined,
    rampHours: archetype.ramp ? randInt(rng, 4, 16) : undefined,
  };
}

export function generateNarrative(rng: Rng, now: Date): StoryBeat[] {
  const beats: StoryBeat[] = [];

  // --- The six flagship incidents, one per requested archetype -------------
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-db-outage',
      serviceKey: 'core-banking-api',
      archetype: 'DATABASE_OUTAGE',
      severity: 'SEV1',
      dayOffset: 24,
      businessHours: false,
      flagship: true,
    }),
  );
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-third-party-outage',
      serviceKey: 'payments-gateway',
      archetype: 'THIRD_PARTY_OUTAGE',
      severity: 'SEV1',
      dayOffset: 58,
      businessHours: false,
      flagship: true,
    }),
  );
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-deployment-failure',
      serviceKey: 'card-processing',
      archetype: 'DEPLOYMENT_FAILURE',
      severity: 'SEV1',
      dayOffset: 89,
      businessHours: true,
      flagship: true,
    }),
  );
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-dependency-failure',
      serviceKey: 'auth-service',
      archetype: 'DEPENDENCY_FAILURE',
      severity: 'SEV2',
      dayOffset: 112,
      businessHours: true,
      flagship: true,
      cascadeTo: ['mobile-bff', 'payments-gateway'],
    }),
  );
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-latency-spike',
      serviceKey: 'mobile-bff',
      archetype: 'LATENCY_SPIKE',
      severity: 'SEV2',
      dayOffset: 137,
      businessHours: true,
      flagship: true,
    }),
  );
  beats.push(
    buildBeat(rng, now, {
      id: 'flagship-memory-leak',
      serviceKey: 'notification-service',
      archetype: 'MEMORY_LEAK',
      severity: 'SEV2',
      dayOffset: 158,
      businessHours: false,
      flagship: true,
    }),
  );

  // --- One incident still in progress right now -----------------------------
  beats.push(
    buildBeat(rng, now, {
      id: 'in-progress-latency-spike',
      serviceKey: 'kyc-service',
      archetype: 'LATENCY_SPIKE',
      severity: 'SEV2',
      dayOffset: HISTORY_DAYS,
      businessHours: false,
      flagship: false,
      inProgress: true,
    }),
  );

  const usedDayOffsets = new Set(
    beats.map((b) => Math.floor((b.start.getTime() - now.getTime()) / 86_400_000)),
  );
  function freeDayOffset(): number {
    let attempt = randInt(rng, 1, HISTORY_DAYS - 2);
    let guard = 0;
    while (usedDayOffsets.has(attempt) && guard < 50) {
      attempt = randInt(rng, 1, HISTORY_DAYS - 2);
      guard += 1;
    }
    usedDayOffsets.add(attempt);
    return attempt;
  }

  function eligibleServiceFor(archetype: ArchetypeKey): string {
    switch (archetype) {
      case 'DATABASE_OUTAGE':
        return pick(rng, DB_OUTAGE_ELIGIBLE);
      case 'MEMORY_LEAK':
        return pick(rng, MEMORY_LEAK_ELIGIBLE);
      case 'LATENCY_SPIKE':
        return pick(rng, LATENCY_ELIGIBLE);
      case 'DEPLOYMENT_FAILURE':
        return pick(rng, DEPLOY_ELIGIBLE);
      case 'THIRD_PARTY_OUTAGE':
        return pick(rng, Object.keys(THIRD_PARTY_ELIGIBLE));
      case 'DEPENDENCY_FAILURE':
        return pick(rng, DEPENDENCY_ORIGINS);
    }
  }

  function cascadeFor(archetype: ArchetypeKey, serviceKey: string): string[] {
    if (archetype !== 'DEPENDENCY_FAILURE') return [];
    const dependents = SERVICES.filter((s) => s.dependsOn.some((d) => d.key === serviceKey)).map(
      (s) => s.key,
    );
    if (dependents.length === 0) return [];
    return [pick(rng, dependents)];
  }

  const archetypeKeys = Object.keys(ARCHETYPES) as ArchetypeKey[];

  // --- Filler SEV2s (5 more, on top of the 6 flagships + 1 in-progress) -----
  for (let i = 0; i < 5; i += 1) {
    const archetype = pick(rng, archetypeKeys);
    const serviceKey = eligibleServiceFor(archetype);
    beats.push(
      buildBeat(rng, now, {
        id: `sev2-${i}`,
        serviceKey,
        archetype,
        severity: 'SEV2',
        dayOffset: freeDayOffset(),
        businessHours: chance(rng, 0.5),
        flagship: false,
        cascadeTo: cascadeFor(archetype, serviceKey),
      }),
    );
  }

  // --- SEV3 (20) --------------------------------------------------------------
  for (let i = 0; i < 20; i += 1) {
    const archetype = pick(rng, archetypeKeys);
    const serviceKey = eligibleServiceFor(archetype);
    const businessBiased = archetype === 'LATENCY_SPIKE' || archetype === 'DEPLOYMENT_FAILURE';
    beats.push(
      buildBeat(rng, now, {
        id: `sev3-${i}`,
        serviceKey,
        archetype,
        severity: 'SEV3',
        dayOffset: freeDayOffset(),
        businessHours: businessBiased ? chance(rng, 0.8) : chance(rng, 0.4),
        flagship: false,
        cascadeTo: cascadeFor(archetype, serviceKey),
      }),
    );
  }

  // --- SEV4 (25) --------------------------------------------------------------
  for (let i = 0; i < 25; i += 1) {
    const archetype = pick(rng, archetypeKeys);
    const serviceKey = eligibleServiceFor(archetype);
    beats.push(
      buildBeat(rng, now, {
        id: `sev4-${i}`,
        serviceKey,
        archetype,
        severity: 'SEV4',
        dayOffset: freeDayOffset(),
        businessHours: chance(rng, 0.55),
        flagship: false,
      }),
    );
  }

  // --- Pure degraded periods (no Incident row) -------------------------------
  for (let i = 0; i < 12; i += 1) {
    const archetype = pick(rng, ['LATENCY_SPIKE', 'DEPENDENCY_FAILURE'] as ArchetypeKey[]);
    const serviceKey = eligibleServiceFor(archetype);
    const dayOffset = freeDayOffset();
    const start = chance(rng, 0.6)
      ? businessHourTimestamp(rng, now, dayOffset)
      : anyHourTimestamp(rng, now, dayOffset);
    const durationMin = randInt(rng, 120, 600);
    beats.push({
      id: `degraded-${i}`,
      serviceKey,
      archetype,
      severity: 'SEV4',
      kind: 'DEGRADED',
      start,
      end: new Date(start.getTime() + durationMin * 60_000),
      flagship: false,
      cascadeTo: [],
      inProgress: false,
      triggerVariant: pickTrigger(rng, archetype),
    });
  }

  return beats.sort((a, b) => a.start.getTime() - b.start.getTime());
}
