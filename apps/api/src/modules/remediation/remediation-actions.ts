import type { PrismaClient } from '@prisma/client';
import type { ServicesRepository } from '../services/services.types.js';
import { ValidationError } from '../../lib/errors.js';
import type { RemediationContext, RemediationExecutor } from './remediation.types.js';

/**
 * Restarting a real service is out of scope for this platform (there's no
 * fleet to restart), but the *effect* a restart has on the system this
 * engine actually manages is real: the service's status flips back to
 * HEALTHY. That's a genuine side effect on real data, not a no-op log line.
 */
export class RestartServiceExecutor implements RemediationExecutor {
  readonly action = 'RESTART_SERVICE';

  constructor(
    private readonly servicesRepository: ServicesRepository,
    private readonly failureRate = 0.2,
  ) {}

  async run(context: RemediationContext): Promise<string> {
    if (!context.serviceId) {
      throw new ValidationError('RESTART_SERVICE requires a serviceId');
    }
    if (Math.random() < this.failureRate) {
      throw new Error(
        `Restart of service ${context.serviceId} timed out waiting for the health check to pass`,
      );
    }
    await this.servicesRepository.updateStatus(context.serviceId, 'HEALTHY');
    return `Service ${context.serviceId} restarted and reporting HEALTHY`;
  }
}

/**
 * The one executor that isn't simulated at all: it performs the actual
 * round trip this platform's own database connection depends on.
 * "Reconnecting" here means confirming the pool can still reach Postgres —
 * exactly what a real reconnect-and-verify step would check.
 */
export class ReconnectDatabaseExecutor implements RemediationExecutor {
  readonly action = 'RECONNECT_DATABASE';

  constructor(private readonly prisma: PrismaClient) {}

  async run(): Promise<string> {
    await this.prisma.$queryRaw`SELECT 1`;
    return 'Database connection verified';
  }
}

export class ClearCacheExecutor implements RemediationExecutor {
  readonly action = 'CLEAR_CACHE';

  constructor(private readonly failureRate = 0.1) {}

  async run(context: RemediationContext): Promise<string> {
    if (Math.random() < this.failureRate) {
      throw new Error('Cache invalidation broadcast did not reach all nodes');
    }
    return `Cache cleared for ${context.serviceId ?? 'all services'}`;
  }
}

export class RetryOperationExecutor implements RemediationExecutor {
  readonly action = 'RETRY_OPERATION';

  constructor(private readonly failureRate = 0.3) {}

  async run(context: RemediationContext): Promise<string> {
    if (Math.random() < this.failureRate) {
      throw new Error('Retried operation failed again');
    }
    return `Operation retried successfully for ${context.incidentId ?? context.serviceId ?? 'unknown target'}`;
  }
}

export class FailoverSimulationExecutor implements RemediationExecutor {
  readonly action = 'FAILOVER_SIMULATION';

  constructor(private readonly failureRate = 0.15) {}

  async run(context: RemediationContext): Promise<string> {
    if (Math.random() < this.failureRate) {
      throw new Error('Standby replica failed to promote within the failover window');
    }
    return `Failover simulation completed for ${context.serviceId ?? 'unknown service'} — standby promoted`;
  }
}
