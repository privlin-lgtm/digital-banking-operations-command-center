import type { AlertComparator, Severity } from '@prisma/client';

export interface AlertThresholds {
  comparator: AlertComparator;
  criticalThreshold: number | null;
  highThreshold: number | null;
  mediumThreshold: number | null;
  lowThreshold: number | null;
}

/**
 * Pure decision logic — no I/O, no Prisma — same pattern as
 * EscalationEngine and SlaCalculator. Given one metric sample and one
 * rule's four (optional) tiers, decide the single most severe tier the
 * value has breached, evaluated critical-first so a value that clears
 * every threshold reports the worst one, not the first one defined.
 * `null` means "no breach" — the caller's signal to resolve any
 * currently-firing alert for this rule, not "fire at the lowest tier."
 */
export class ThresholdEvaluator {
  evaluate(value: number, thresholds: AlertThresholds): Severity | null {
    const breaches = (threshold: number | null): boolean => {
      if (threshold === null) {
        return false;
      }
      return thresholds.comparator === 'GREATER_THAN' ? value > threshold : value < threshold;
    };

    if (breaches(thresholds.criticalThreshold)) return 'SEV1';
    if (breaches(thresholds.highThreshold)) return 'SEV2';
    if (breaches(thresholds.mediumThreshold)) return 'SEV3';
    if (breaches(thresholds.lowThreshold)) return 'SEV4';
    return null;
  }
}
