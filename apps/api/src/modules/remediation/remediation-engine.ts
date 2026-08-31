import type { Logger } from 'pino';
import type { AuditLogger } from '../audit/audit-logger.js';
import type { ServicesRepository } from '../services/services.types.js';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';
import { withRetry } from './retry.js';
import type {
  RemediationContext,
  RemediationExecutor,
  RemediationOutcome,
  RemediationResult,
} from './remediation.types.js';
import { REMEDIATION_ACTIONS, type RemediationActionType } from './remediation.types.js';

/** The only slice of IncidentsService the engine actually needs — see IncidentRcaGate/UserLookup for the same narrow-port pattern. */
export interface IncidentResolver {
  resolve(incidentId: string, resolutionSummary: string, actorId: string): Promise<unknown>;
}

export interface RemediationEngineOptions {
  retry: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenSuccessesToClose: number;
  };
}

const DEFAULT_OPTIONS: RemediationEngineOptions = {
  retry: { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2000 },
  circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30_000, halfOpenSuccessesToClose: 1 },
};

/**
 * Wraps every registered executor in the same reliability envelope —
 * retry with exponential backoff inside a circuit breaker, with a
 * fallback when both are exhausted — so an individual executor (see
 * remediation-actions.ts) only ever has to implement "do the thing," not
 * "do the thing resiliently." One CircuitBreaker instance per action
 * type: a flapping cache-clear shouldn't trip the breaker guarding
 * database reconnects.
 */
export class RemediationEngine {
  private readonly breakers = new Map<RemediationActionType, CircuitBreaker>();

  constructor(
    private readonly executors: Partial<Record<RemediationActionType, RemediationExecutor>>,
    private readonly servicesRepository: ServicesRepository,
    private readonly incidentResolver: IncidentResolver,
    private readonly auditLogger: AuditLogger,
    private readonly logger: Logger,
    private readonly options: RemediationEngineOptions = DEFAULT_OPTIONS,
  ) {
    for (const action of REMEDIATION_ACTIONS) {
      this.breakers.set(action, new CircuitBreaker(action, this.options.circuitBreaker));
    }
  }

  getCircuitStates(): Record<RemediationActionType, string> {
    const states = {} as Record<RemediationActionType, string>;
    for (const [action, breaker] of this.breakers) {
      states[action] = breaker.getState();
    }
    return states;
  }

  async execute(
    action: RemediationActionType,
    context: RemediationContext,
    opts: { autoResolveIncident?: boolean } = {},
  ): Promise<RemediationResult> {
    const executor = this.executors[action];
    if (!executor) {
      throw new Error(`No executor registered for remediation action "${action}"`);
    }

    const breaker = this.getBreaker(action);
    let attempts = 0;

    try {
      const detail = await breaker.execute(() =>
        withRetry(() => {
          attempts += 1;
          return executor.run(context);
        }, this.options.retry),
      );

      this.logger.info({ action, attempts, ...context }, 'Remediation action succeeded');
      await this.recordAudit(action, context, 'SUCCESS', { attempts, detail });

      if (opts.autoResolveIncident && context.incidentId) {
        await this.incidentResolver.resolve(
          context.incidentId,
          `Auto-resolved by the remediation engine: ${action} succeeded — ${detail}`,
          context.actorId,
        );
      }

      return { action, outcome: 'SUCCESS', detail, circuitState: breaker.getState(), attempts };
    } catch (error) {
      return this.handleFailure(action, context, breaker, attempts, error);
    }
  }

  private async handleFailure(
    action: RemediationActionType,
    context: RemediationContext,
    breaker: CircuitBreaker,
    attempts: number,
    error: unknown,
  ): Promise<RemediationResult> {
    const reason = error instanceof Error ? error.message : String(error);
    const circuitWasOpen = error instanceof CircuitBreakerOpenError;

    this.logger.warn(
      { action, attempts, circuitWasOpen, reason, ...context },
      'Remediation action failed',
    );

    // Fallback strategy: can't fix it, so degrade safely instead of doing
    // nothing. For a service-scoped action that's marking the service
    // DEGRADED (visible on the dashboard, eligible for its own alerting)
    // rather than leaving stale HEALTHY/UNKNOWN state on record. There's
    // no safe fallback for an action with no target service — those
    // simply report FAILURE for a human to pick up.
    let outcome: RemediationOutcome = 'FAILURE';
    let detail = reason;

    if (context.serviceId) {
      try {
        await this.servicesRepository.updateStatus(context.serviceId, 'DEGRADED');
        outcome = 'FALLBACK';
        detail = `${reason} — service marked DEGRADED pending manual intervention`;
      } catch {
        // Fallback itself failed; fall through and report the original failure.
      }
    }

    await this.recordAudit(action, context, outcome, { attempts, reason, circuitWasOpen });
    return { action, outcome, detail, circuitState: breaker.getState(), attempts };
  }

  private getBreaker(action: RemediationActionType): CircuitBreaker {
    const breaker = this.breakers.get(action);
    if (!breaker) {
      throw new Error(`No circuit breaker configured for "${action}"`);
    }
    return breaker;
  }

  private async recordAudit(
    action: RemediationActionType,
    context: RemediationContext,
    outcome: RemediationOutcome,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const entityId = context.incidentId ?? context.serviceId;
    await this.auditLogger.record({
      actorId: context.actorId,
      action: `remediation.${action.toLowerCase()}`,
      entityType: context.incidentId ? 'Incident' : 'Service',
      ...(entityId ? { entityId } : {}),
      metadata: { outcome, ...metadata },
    });
  }
}
