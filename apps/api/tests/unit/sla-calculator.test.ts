import { describe, expect, it } from 'vitest';
import { SlaCalculator } from '../../src/modules/sla/sla-calculator.js';

describe('SlaCalculator', () => {
  const calculator = new SlaCalculator();

  it('computes 100% availability and zero error-budget consumption with no downtime', () => {
    const result = calculator.calculate({
      windowMinutes: 43_200, // 30 days
      downtimeMinutes: 0,
      targetPercent: 99.9,
      responseTimeSamplesMs: [],
      detectionGapsMinutes: [],
      recoveryTimesMinutes: [],
    });

    expect(result.actualPercent).toBe(100);
    expect(result.errorBudgetConsumedMinutes).toBe(0);
    expect(result.breached).toBe(false);
    // A 99.9% target over 30 days allows ~43.2 minutes of downtime.
    expect(result.errorBudgetMinutes).toBeCloseTo(43.2, 1);
  });

  it('flags a breach once downtime exceeds what the target allows', () => {
    const result = calculator.calculate({
      windowMinutes: 43_200,
      downtimeMinutes: 100, // well past the ~43.2-minute budget for 99.9%
      targetPercent: 99.9,
      responseTimeSamplesMs: [],
      detectionGapsMinutes: [],
      recoveryTimesMinutes: [],
    });

    expect(result.breached).toBe(true);
    expect(result.actualPercent).toBeLessThan(99.9);
    expect(result.errorBudgetConsumedMinutes).toBe(100);
  });

  it('does not flag a breach when downtime stays within the error budget', () => {
    const result = calculator.calculate({
      windowMinutes: 43_200,
      downtimeMinutes: 10,
      targetPercent: 99.9,
      responseTimeSamplesMs: [],
      detectionGapsMinutes: [],
      recoveryTimesMinutes: [],
    });

    expect(result.breached).toBe(false);
  });

  it('returns null (not zero) for a mean metric with no samples', () => {
    const result = calculator.calculate({
      windowMinutes: 1440,
      downtimeMinutes: 0,
      targetPercent: 99.9,
      responseTimeSamplesMs: [],
      detectionGapsMinutes: [],
      recoveryTimesMinutes: [],
    });

    expect(result.avgResponseTimeMs).toBeNull();
    expect(result.meanTimeToDetectMinutes).toBeNull();
    expect(result.meanTimeToRecoverMinutes).toBeNull();
  });

  it('averages each metric independently from its own sample set', () => {
    const result = calculator.calculate({
      windowMinutes: 1440,
      downtimeMinutes: 0,
      targetPercent: 99.9,
      responseTimeSamplesMs: [100, 200, 300],
      detectionGapsMinutes: [2, 4],
      recoveryTimesMinutes: [30, 60, 90, 120],
    });

    expect(result.avgResponseTimeMs).toBe(200);
    expect(result.meanTimeToDetectMinutes).toBe(3);
    expect(result.meanTimeToRecoverMinutes).toBe(75);
  });

  it('treats a zero-length window as 100% available rather than dividing by zero', () => {
    const result = calculator.calculate({
      windowMinutes: 0,
      downtimeMinutes: 0,
      targetPercent: 99.9,
      responseTimeSamplesMs: [],
      detectionGapsMinutes: [],
      recoveryTimesMinutes: [],
    });

    expect(result.actualPercent).toBe(100);
    expect(Number.isFinite(result.errorBudgetMinutes)).toBe(true);
  });
});
