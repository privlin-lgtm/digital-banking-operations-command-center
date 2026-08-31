import { describe, expect, it } from 'vitest';
import { FailureScenarioGenerator } from '../../src/modules/failure-simulator/scenario-generator.js';

const fixedRandom = () => 0.5;

describe('FailureScenarioGenerator', () => {
  const generator = new FailureScenarioGenerator();

  it('generates a db_connection_errors sample deep in critical territory for DATABASE_OUTAGE', () => {
    const samples = generator.generate('DATABASE_OUTAGE', 0, fixedRandom);
    expect(samples).toEqual([
      { metricName: 'db_connection_errors_percent', value: 97.5, unit: 'percent' },
    ]);
  });

  it('generates one cpu_usage_percent sample for CPU_SPIKE', () => {
    const samples = generator.generate('CPU_SPIKE', 0, fixedRandom);
    expect(samples).toEqual([{ metricName: 'cpu_usage_percent', value: 93, unit: 'percent' }]);
  });

  it('generates both latency and error-rate samples for SERVICE_DEGRADATION', () => {
    const samples = generator.generate('SERVICE_DEGRADATION', 0, fixedRandom);
    expect(samples).toEqual([
      { metricName: 'p99_latency_ms', value: 525, unit: 'ms' },
      { metricName: 'error_rate_percent', value: 11.5, unit: 'percent' },
    ]);
  });

  it('generates a third_party_api_error_rate sample for THIRD_PARTY_API_FAILURE', () => {
    const samples = generator.generate('THIRD_PARTY_API_FAILURE', 0, fixedRandom);
    expect(samples).toEqual([
      { metricName: 'third_party_api_error_rate_percent', value: 95, unit: 'percent' },
    ]);
  });

  it('ramps NETWORK_LATENCY up with tickCount rather than resampling the same band', () => {
    const early = generator.generate('NETWORK_LATENCY', 0, fixedRandom)[0]!;
    const later = generator.generate('NETWORK_LATENCY', 10, fixedRandom)[0]!;
    expect(later.value).toBeGreaterThan(early.value);
  });

  it('ramps MEMORY_LEAK up with tickCount, capped at 98', () => {
    const early = generator.generate('MEMORY_LEAK', 0, fixedRandom)[0]!;
    const later = generator.generate('MEMORY_LEAK', 5, fixedRandom)[0]!;
    const capped = generator.generate('MEMORY_LEAK', 1000, fixedRandom)[0]!;
    expect(later.value).toBeGreaterThan(early.value);
    expect(capped.value).toBe(98);
  });
});
