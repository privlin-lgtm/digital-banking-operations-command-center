export const REMEDIATION_ACTIONS = [
  'RESTART_SERVICE',
  'RETRY_OPERATION',
  'RECONNECT_DATABASE',
  'CLEAR_CACHE',
  'FAILOVER_SIMULATION',
] as const;

export type RemediationActionType = (typeof REMEDIATION_ACTIONS)[number];

/** Narrows a free-text value (e.g. AlertRule.autoRemediateAction, stored as a plain string so a new action ships as code, not a migration) to a real RemediationActionType. */
export function isRemediationActionType(value: string): value is RemediationActionType {
  return (REMEDIATION_ACTIONS as readonly string[]).includes(value);
}

export interface RemediationContext {
  serviceId?: string | undefined;
  incidentId?: string | undefined;
  actorId: string;
}

export type RemediationOutcome = 'SUCCESS' | 'FALLBACK' | 'FAILURE';

export interface RemediationResult {
  action: RemediationActionType;
  outcome: RemediationOutcome;
  detail: string;
  circuitState: string;
  attempts: number;
}

/** One concrete action the engine can run. Each executor knows how to DO the thing; the engine owns retry/circuit-breaking/fallback around all of them uniformly. */
export interface RemediationExecutor {
  readonly action: RemediationActionType;
  run(context: RemediationContext): Promise<string>;
}
