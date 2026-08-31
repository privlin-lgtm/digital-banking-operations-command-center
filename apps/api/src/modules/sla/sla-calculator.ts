export interface SlaCalculationInputs {
  windowMinutes: number;
  /** Total minutes the service was down, already reduced to its overlap with the window. */
  downtimeMinutes: number;
  targetPercent: number;
  /** Raw response-time samples in the window, in ms — averaged here, not at the data layer, so every "mean" metric goes through the same code path. */
  responseTimeSamplesMs: number[];
  /** Gap in minutes between an alert firing and the incident it correlated to being created, one per incident that had a linked alert. */
  detectionGapsMinutes: number[];
  /** Gap in minutes between an incident opening and resolving, one per incident resolved in the window. */
  recoveryTimesMinutes: number[];
}

export interface SlaCalculationResult {
  actualPercent: number;
  errorBudgetMinutes: number;
  errorBudgetConsumedMinutes: number;
  breached: boolean;
  avgResponseTimeMs: number | null;
  meanTimeToDetectMinutes: number | null;
  meanTimeToRecoverMinutes: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** null for an empty sample set — "no data" is a different fact than "zero", and averaging in a phantom zero would understate the real mean. */
function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Pure arithmetic, no I/O — given how many minutes a window covered, how
 * many of those minutes were downtime, and raw sample arrays for the
 * other tracked metrics, produce the numbers an SlaRecord row stores.
 * Gathering those inputs (querying Incident/Alert/Metric) is a separate
 * concern — see SlaDataSource — precisely so this arithmetic can be unit
 * tested with plain numbers instead of a database.
 */
export class SlaCalculator {
  calculate(input: SlaCalculationInputs): SlaCalculationResult {
    const actualPercent =
      input.windowMinutes > 0
        ? ((input.windowMinutes - input.downtimeMinutes) / input.windowMinutes) * 100
        : 100;
    const errorBudgetMinutes = (input.windowMinutes * (100 - input.targetPercent)) / 100;

    return {
      actualPercent: round2(actualPercent),
      errorBudgetMinutes: round2(errorBudgetMinutes),
      errorBudgetConsumedMinutes: round2(input.downtimeMinutes),
      breached: actualPercent < input.targetPercent,
      avgResponseTimeMs: average(input.responseTimeSamplesMs),
      meanTimeToDetectMinutes: average(input.detectionGapsMinutes),
      meanTimeToRecoverMinutes: average(input.recoveryTimesMinutes),
    };
  }
}
