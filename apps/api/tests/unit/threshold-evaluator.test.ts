import { describe, expect, it } from 'vitest';
import { ThresholdEvaluator } from '../../src/modules/alerts/threshold-evaluator.js';

describe('ThresholdEvaluator', () => {
  const evaluator = new ThresholdEvaluator();

  it('returns null when no threshold is breached', () => {
    const result = evaluator.evaluate(100, {
      comparator: 'GREATER_THAN',
      criticalThreshold: 2000,
      highThreshold: 1000,
      mediumThreshold: 500,
      lowThreshold: 200,
    });
    expect(result).toBeNull();
  });

  it('evaluates most-severe-first for a GREATER_THAN rule', () => {
    const thresholds = {
      comparator: 'GREATER_THAN' as const,
      criticalThreshold: 2000,
      highThreshold: 1000,
      mediumThreshold: 500,
      lowThreshold: 200,
    };
    expect(evaluator.evaluate(250, thresholds)).toBe('SEV4');
    expect(evaluator.evaluate(600, thresholds)).toBe('SEV3');
    expect(evaluator.evaluate(1500, thresholds)).toBe('SEV2');
    expect(evaluator.evaluate(3000, thresholds)).toBe('SEV1');
  });

  it('supports LESS_THAN for metrics where low is bad, like availability', () => {
    const thresholds = {
      comparator: 'LESS_THAN' as const,
      criticalThreshold: 95,
      highThreshold: 98,
      mediumThreshold: 99,
      lowThreshold: null,
    };
    expect(evaluator.evaluate(99.9, thresholds)).toBeNull();
    expect(evaluator.evaluate(98.5, thresholds)).toBe('SEV3');
    expect(evaluator.evaluate(97, thresholds)).toBe('SEV2');
    expect(evaluator.evaluate(90, thresholds)).toBe('SEV1');
  });

  it('treats a null tier as "not configured", never as a breach', () => {
    const result = evaluator.evaluate(999_999, {
      comparator: 'GREATER_THAN',
      criticalThreshold: null,
      highThreshold: null,
      mediumThreshold: null,
      lowThreshold: null,
    });
    expect(result).toBeNull();
  });

  it('a rule with only one tier configured only ever fires that tier', () => {
    const thresholds = {
      comparator: 'GREATER_THAN' as const,
      criticalThreshold: 2000,
      highThreshold: null,
      mediumThreshold: null,
      lowThreshold: null,
    };
    expect(evaluator.evaluate(1999, thresholds)).toBeNull();
    expect(evaluator.evaluate(2001, thresholds)).toBe('SEV1');
  });
});
