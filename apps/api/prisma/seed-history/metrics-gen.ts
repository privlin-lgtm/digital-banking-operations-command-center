import { HISTORY_DAYS, METRIC_CONFIG, SERVICES, type ArchetypeKey } from './config.js';
import { gaussianNoise, randFloat, type Rng } from './rng.js';
import type { StoryBeat } from './narrative.js';

export interface MetricSample {
  serviceKey: string;
  metricName: string;
  value: number;
  unit: string;
  recordedAt: Date;
}

/** How strongly each archetype pushes a given metric toward its impactRange (0 = untouched, 1 = full swing). */
const IMPACT_WEIGHTS: Record<ArchetypeKey, Record<string, number>> = {
  DATABASE_OUTAGE: {
    db_connection_pool_used_percent: 1,
    error_rate_percent: 0.9,
    availability_percent: 0.9,
    p99_latency_ms: 0.7,
    cpu_utilization_percent: 0.3,
  },
  DEPENDENCY_FAILURE: {
    error_rate_percent: 0.9,
    p99_latency_ms: 0.6,
    availability_percent: 0.5,
  },
  LATENCY_SPIKE: {
    p99_latency_ms: 1,
    requests_per_second: 0.6,
    cpu_utilization_percent: 0.7,
    error_rate_percent: 0.3,
  },
  DEPLOYMENT_FAILURE: {
    error_rate_percent: 1,
    p99_latency_ms: 0.6,
    availability_percent: 0.5,
  },
  MEMORY_LEAK: {
    memory_utilization_percent: 1,
    cpu_utilization_percent: 0.4,
    error_rate_percent: 0.6,
  },
  THIRD_PARTY_OUTAGE: {
    error_rate_percent: 1,
    availability_percent: 0.6,
  },
};

function impactWeight(archetype: ArchetypeKey, metric: string): number {
  const table = IMPACT_WEIGHTS[archetype];
  const direct = table[metric];
  if (direct !== undefined) return direct;
  if (metric.startsWith('synthetic.')) {
    if (metric.endsWith('success_rate')) return (table.error_rate_percent ?? 0) * 0.9;
    if (metric.endsWith('latency_ms')) return (table.p99_latency_ms ?? 0) * 0.8;
  }
  return 0;
}

function diurnalFactor(hour: Date): number {
  const h = hour.getHours();
  const day = hour.getDay();
  const isWeekend = day === 0 || day === 6;
  const isBusinessHour = h >= 9 && h < 18;
  if (isWeekend) return isBusinessHour ? 0.85 : 0.6;
  return isBusinessHour ? 1.35 : 0.85;
}

function decimalsFor(unit: string): number {
  if (unit === 'percent') return 2;
  if (unit === 'seconds') return 1;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smooth rise-hold-fall envelope in [0,1] for a point in time within an incident window. */
function spikeEnvelope(t: number, start: number, end: number): number {
  if (t < start || t > end) return 0;
  const duration = end - start;
  const rampUp = Math.max(duration * 0.15, 3 * 60_000);
  const rampDown = Math.max(duration * 0.25, 5 * 60_000);
  if (t - start < rampUp) return (t - start) / rampUp;
  if (end - t < rampDown) return (end - t) / rampDown;
  return 1;
}

/** Slow climb for `rampHours` before `start`, an acute plateau through `end`, then a sharp drop (the restart). */
function memoryLeakEnvelope(t: number, rampStart: number, start: number, end: number): number {
  if (t < rampStart || t > end) return 0;
  if (t < start) return 0.8 * ((t - rampStart) / (start - rampStart));
  return 0.8 + 0.2 * ((t - start) / Math.max(end - start, 60_000));
}

function beatEnvelope(beat: StoryBeat, t: number): number {
  if (beat.archetype === 'MEMORY_LEAK' && beat.rampHours) {
    const rampStart = beat.start.getTime() - beat.rampHours * 3_600_000;
    return memoryLeakEnvelope(t, rampStart, beat.start.getTime(), beat.end.getTime());
  }
  return spikeEnvelope(t, beat.start.getTime(), beat.end.getTime());
}

export function generateMetricSamples(rng: Rng, beats: StoryBeat[], now: Date): MetricSample[] {
  const samples: MetricSample[] = [];
  const start = new Date(now);
  start.setDate(start.getDate() - HISTORY_DAYS);
  start.setMinutes(0, 0, 0);

  const beatsByService = new Map<string, StoryBeat[]>();
  for (const beat of beats) {
    if (!beatsByService.has(beat.serviceKey)) beatsByService.set(beat.serviceKey, []);
    beatsByService.get(beat.serviceKey)!.push(beat);
    for (const cascadeKey of beat.cascadeTo) {
      if (!beatsByService.has(cascadeKey)) beatsByService.set(cascadeKey, []);
      beatsByService.get(cascadeKey)!.push(beat);
    }
  }

  for (const service of SERVICES) {
    const relevantBeats = beatsByService.get(service.key) ?? [];
    for (const metricName of service.metrics) {
      const cfg = METRIC_CONFIG[metricName];
      if (!cfg) continue;
      const center = randFloat(rng, cfg.baseline[0], cfg.baseline[1]);
      const noiseStdDev = (cfg.baseline[1] - cfg.baseline[0]) * 0.08 || center * 0.05;

      for (let t = start.getTime(); t <= now.getTime(); t += 3_600_000) {
        const hourDate = new Date(t);
        const diurnalMult = cfg.diurnal ? diurnalFactor(hourDate) : 1;
        let value = center * diurnalMult + gaussianNoise(rng, noiseStdDev);

        let bestImpact = 0;
        let bestBeat: StoryBeat | null = null;
        for (const beat of relevantBeats) {
          const isDirect = beat.serviceKey === service.key;
          const weight = impactWeight(beat.archetype, metricName);
          if (weight <= 0) continue;
          const envelope = beatEnvelope(beat, t);
          if (envelope <= 0) continue;
          const magnitude = envelope * weight * (isDirect ? 1 : 0.4);
          if (magnitude > bestImpact) {
            bestImpact = magnitude;
            bestBeat = beat;
          }
        }

        if (bestImpact > 0 && bestBeat) {
          const [lo, hi] = cfg.impactRange;
          const target = lo + (hi - lo) * (0.5 + rng() * 0.5);
          value = value + (target - value) * bestImpact;
        }

        value = clamp(value, cfg.clamp[0], cfg.clamp[1]);
        samples.push({
          serviceKey: service.key,
          metricName,
          value: Number(value.toFixed(decimalsFor(cfg.unit))),
          unit: cfg.unit,
          recordedAt: hourDate,
        });
      }
    }
  }

  return samples;
}
