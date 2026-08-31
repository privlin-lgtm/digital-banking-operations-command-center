import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { getContainer } from './container.js';
import { resolveSystemActorId } from './modules/incidents/system-actor.js';

/**
 * Wires one named recurring job onto an in-process interval, attributing
 * its automated audit trail to the reserved system actor. Shared by the
 * escalation sweep and the SLA rollup — same "correct on one instance,
 * redundant-but-harmless on several, disable and use an external
 * scheduler at real scale" trade-off applies to both. See
 * IncidentEscalationService.runSweep's scaling note for the full
 * reasoning.
 */
function startScheduledJob(
  jobName: string,
  envVarName: string,
  intervalMs: number,
  systemActorEmail: string,
  run: (actorId: string) => Promise<unknown>,
): NodeJS.Timeout | undefined {
  if (intervalMs === 0) {
    logger.info(`${jobName} disabled (${envVarName}=0)`);
    return undefined;
  }

  const jobLogger = logger.child({ module: `scheduler:${jobName}` });

  const timer = setInterval(() => {
    void (async () => {
      const actorId = await resolveSystemActorId(prisma, systemActorEmail);
      if (!actorId) {
        jobLogger.warn(
          { systemActorEmail },
          'System actor not found — skipping run (has the seed run?)',
        );
        return;
      }
      try {
        await run(actorId);
      } catch (error) {
        jobLogger.error({ err: error }, `${jobName} failed`);
      }
    })();
  }, intervalMs);

  // Don't let this timer keep the process alive on its own — shutdown()
  // below still stops it explicitly, but this avoids a hang if it doesn't.
  timer.unref();
  logger.info({ intervalMs }, `${jobName} scheduled`);
  return timer;
}

async function main(): Promise<void> {
  const env = loadEnv();

  // Fail fast on boot: if the database is unreachable, crash immediately
  // with a clear log line instead of coming up "healthy" and returning a
  // 500 from every request that touches Prisma. An orchestrator (Docker's
  // restart policy, Kubernetes' backoff) treats a startup crash as a
  // signal to retry with backoff, which is exactly the right response to
  // "the database isn't ready yet."
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connection verified');

  const app = createApp();
  const { incidentEscalation, sla } = getContainer();

  const server = app.listen(env.API_PORT, env.API_HOST, () => {
    logger.info({ host: env.API_HOST, port: env.API_PORT }, 'BankOps API listening');
  });

  const timers = [
    startScheduledJob(
      'escalation-sweep',
      'ESCALATION_SWEEP_INTERVAL_MS',
      env.ESCALATION_SWEEP_INTERVAL_MS,
      env.SYSTEM_ACTOR_EMAIL,
      (actorId) => incidentEscalation.service.runSweep(actorId),
    ),
    startScheduledJob(
      'sla-rollup',
      'SLA_ROLLUP_INTERVAL_MS',
      env.SLA_ROLLUP_INTERVAL_MS,
      env.SYSTEM_ACTOR_EMAIL,
      (actorId) => sla.service.runRollup(actorId),
    ),
  ].filter((timer): timer is NodeJS.Timeout => timer !== undefined);

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down');
    for (const timer of timers) {
      clearInterval(timer);
    }
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Fatal error during startup');
  process.exit(1);
});
