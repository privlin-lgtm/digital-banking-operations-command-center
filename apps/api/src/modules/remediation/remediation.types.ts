export const REMEDIATION_ACTIONS = [
  'RESTART_SERVICE',
  'RETRY_OPERATION',
  'RECONNECT_DATABASE',
  'CLEAR_CACHE',
  'FAILOVER_SIMULATION',
] as const;

export type RemediationActionType = (typeof REMEDIATION_ACTIONS)[number];

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
