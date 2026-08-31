import { beforeEach, describe, expect, it } from 'vitest';
import { RemediationEngine } from '../../src/modules/remediation/remediation-engine.js';
import type {
  RemediationContext,
  RemediationExecutor,
} from '../../src/modules/remediation/remediation.types.js';
import { FakeAuditLogger } from '../fakes/fake-audit-logger.js';
import { FakeIncidentResolver } from '../fakes/fake-incident-resolver.js';
import { FakeServicesRepository, makeService } from '../fakes/fake-services-repository.js';
import { createSilentLogger } from '../fakes/silent-logger.js';

function fakeExecutor(
  action: RemediationExecutor['action'],
  run: RemediationExecutor['run'],
): RemediationExecutor {
  return { action, run };
}

const FAST_OPTIONS = {
  retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
  circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 10_000, halfOpenSuccessesToClose: 1 },
};

describe('RemediationEngine', () => {
  let servicesRepository: FakeServicesRepository;
  let incidentResolver: FakeIncidentResolver;
  let auditLogger: FakeAuditLogger;

  beforeEach(() => {
    servicesRepository = new FakeServicesRepository();
    incidentResolver = new FakeIncidentResolver();
    auditLogger = new FakeAuditLogger();
  });

  it('reports SUCCESS and records an audit entry when the executor succeeds', async () => {
    const engine = new RemediationEngine(
      { CLEAR_CACHE: fakeExecutor('CLEAR_CACHE', async () => 'cache cleared') },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    const result = await engine.execute('CLEAR_CACHE', { actorId: 'user-1' });

    expect(result).toMatchObject({ outcome: 'SUCCESS', attempts: 1 });
    expect(auditLogger.entries[0]).toMatchObject({ action: 'remediation.clear_cache' });
  });

  it('retries a failing executor before giving up, per the configured attempt count', async () => {
    let calls = 0;
    const engine = new RemediationEngine(
      {
        RETRY_OPERATION: fakeExecutor('RETRY_OPERATION', async () => {
          calls += 1;
          if (calls < 2) throw new Error('transient');
          return 'succeeded on retry';
        }),
      },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    const result = await engine.execute('RETRY_OPERATION', { actorId: 'user-1' });
    expect(result.outcome).toBe('SUCCESS');
    expect(result.attempts).toBe(2);
  });

  it('falls back to marking the service DEGRADED when a service-scoped action exhausts retries', async () => {
    const service = servicesRepository.seed(makeService({ status: 'HEALTHY' }));
    const engine = new RemediationEngine(
      {
        RESTART_SERVICE: fakeExecutor('RESTART_SERVICE', async () => {
          throw new Error('restart always fails in this test');
        }),
      },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    const result = await engine.execute('RESTART_SERVICE', {
      serviceId: service.id,
      actorId: 'user-1',
    });

    expect(result.outcome).toBe('FALLBACK');
    const updated = await servicesRepository.findById(service.id);
    expect(updated?.status).toBe('DEGRADED');
  });

  it('reports plain FAILURE (no fallback) for an action with no serviceId', async () => {
    const engine = new RemediationEngine(
      {
        RETRY_OPERATION: fakeExecutor('RETRY_OPERATION', async () => {
          throw new Error('always fails');
        }),
      },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    const result = await engine.execute('RETRY_OPERATION', { actorId: 'user-1' });
    expect(result.outcome).toBe('FAILURE');
  });

  it('auto-resolves the linked incident when requested and the action succeeds', async () => {
    const engine = new RemediationEngine(
      { RECONNECT_DATABASE: fakeExecutor('RECONNECT_DATABASE', async () => 'db reachable') },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    await engine.execute(
      'RECONNECT_DATABASE',
      { incidentId: 'inc-1', actorId: 'user-1' },
      { autoResolveIncident: true },
    );

    expect(incidentResolver.calls).toHaveLength(1);
    expect(incidentResolver.calls[0]).toMatchObject({ incidentId: 'inc-1', actorId: 'user-1' });
  });

  it('does not auto-resolve when the action fails', async () => {
    const engine = new RemediationEngine(
      {
        RECONNECT_DATABASE: fakeExecutor('RECONNECT_DATABASE', async () => {
          throw new Error('db unreachable');
        }),
      },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    await engine.execute(
      'RECONNECT_DATABASE',
      { incidentId: 'inc-1', actorId: 'user-1' },
      { autoResolveIncident: true },
    );
    expect(incidentResolver.calls).toHaveLength(0);
  });

  it('opens the circuit breaker for an action after repeated failures, independent of other actions', async () => {
    const context: RemediationContext = { actorId: 'user-1' };
    const engine = new RemediationEngine(
      {
        RETRY_OPERATION: fakeExecutor('RETRY_OPERATION', async () => {
          throw new Error('down');
        }),
        CLEAR_CACHE: fakeExecutor('CLEAR_CACHE', async () => 'ok'),
      },
      servicesRepository,
      incidentResolver,
      auditLogger,
      createSilentLogger(),
      FAST_OPTIONS,
    );

    // failureThreshold is 2 — two failed execute() calls (each already
    // retried internally) trips this action's breaker.
    await engine.execute('RETRY_OPERATION', context);
    await engine.execute('RETRY_OPERATION', context);

    expect(engine.getCircuitStates().RETRY_OPERATION).toBe('OPEN');
    expect(engine.getCircuitStates().CLEAR_CACHE).toBe('CLOSED');
  });
});
