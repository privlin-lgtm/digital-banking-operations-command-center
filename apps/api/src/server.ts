import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';

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

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down');
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
