import type { FailureScenario } from '@prisma/client';

export interface ScenarioMetricSample {
  metricName: string;
  value: number;
  unit: string;
}

type ScenarioGeneratorFn = (tickCount: number, random: () => number) => ScenarioMetricSample[];

/**
 * One entry per FailureScenario — a `Record`, not a `switch`, so a new
 * enum member fails to compile here until it's given a generator instead
 * of silently falling through a missing `case`. Each function is a pure
 * tick-count -> samples mapping (same shape as ThresholdEvaluator): no
 * I/O, randomness injected so tests can pin it down.
 */
const GENERATORS: Record<FailureScenario, ScenarioGeneratorFn> = {
  DATABASE_OUTAGE: (_tickCount, random) => [
    { metricName: 'db_connection_errors_percent', value: 95 + random() * 5, unit: 'percent' },
  ],
  NETWORK_LATENCY: (tickCount, random) => [
    { metricName: 'p99_latency_ms', value: 600 + tickCount * 15 + random() * 100, unit: 'ms' },
  ],
  // Ramps up rather than jumping straight to critical — the whole point of
  // simulating a *leak* instead of an instant failure is a metric that
  // trends worse tick over tick, eventually crossing a rule's threshold.
  MEMORY_LEAK: (tickCount, random) => [
    {
      metricName: 'memory_usage_percent',
      value: Math.min(98, 45 + tickCount * 3 + random() * 4),
      unit: 'percent',
    },
  ],
  CPU_SPIKE: (_tickCount, random) => [
    { metricName: 'cpu_usage_percent', value: 88 + random() * 10, unit: 'percent' },
  ],
  SERVICE_DEGRADATION: (_tickCount, random) => [
    { metricName: 'p99_latency_ms', value: 450 + random() * 150, unit: 'ms' },
    { metricName: 'error_rate_percent', value: 8 + random() * 7, unit: 'percent' },
  ],
  THIRD_PARTY_API_FAILURE: (_tickCount, random) => [
    {
      metricName: 'third_party_api_error_rate_percent',
      value: 90 + random() * 10,
      unit: 'percent',
    },
  ],
};

export class FailureScenarioGenerator {
  generate(
    scenario: FailureScenario,
    tickCount: number,
    random: () => number = Math.random,
  ): ScenarioMetricSample[] {
    return GENERATORS[scenario](tickCount, random);
  }
}
