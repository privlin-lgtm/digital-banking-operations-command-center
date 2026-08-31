import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { getContainer } from './container.js';
import { resolveSystemActorId } from './modules/incidents/system-actor.js';

function startEscalationSweep(
  intervalMs: number,
  systemActorEmail: string,
): NodeJS.Timeout | undefined {
  if (intervalMs === 0) {
    logger.info('Escalation sweep disabled (ESCALATION_SWEEP_INTERVAL_MS=0)');
    return undefined;
  }

  const { incidentEscalation } = getContainer();
  const sweepLogger = logger.child({ module: 'escalation-scheduler' });

  const timer = setInterval(() => {
    void (async () => {
      const actorId = await resolveSystemActorId(prisma, systemActorEmail);
      if (!actorId) {
        sweepLogger.warn(
          { systemActorEmail },
          'System actor not found — skipping sweep (has the seed run?)',
        );
        return;
      }
      try {
        await incidentEscalation.service.runSweep(actorId);
      } catch (error) {
        sweepLogger.error({ err: error }, 'Escalation sweep failed');
      }
    })();
  }, intervalMs);

  // Don't let this timer keep the process alive on its own — shutdown()
  // below still stops it explicitly, but this avoids a hang if it doesn't.
  timer.unref();
  logger.info({ intervalMs }, 'Escalation sweep scheduled');
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

  const server = app.listen(env.API_PORT, env.API_HOST, () => {
    logger.info({ host: env.API_HOST, port: env.API_PORT }, 'BankOps API listening');
  });

  // See IncidentEscalationService.runSweep's scaling note: this in-process
  // timer is correct for a single instance and redundant-but-harmless
  // across several. A multi-instance deployment should disable this
  // (ESCALATION_SWEEP_INTERVAL_MS=0) and drive the sweep from one external
  // scheduler hitting POST /api/v1/incidents/escalations/sweep instead.
  const sweepTimer = startEscalationSweep(env.ESCALATION_SWEEP_INTERVAL_MS, env.SYSTEM_ACTOR_EMAIL);

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down');
    if (sweepTimer) {
      clearInterval(sweepTimer);
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
