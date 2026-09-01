import { Redis } from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import type { Store } from 'express-rate-limit';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

let redisClient: Redis | undefined;

function getRedisClient(url: string): Redis {
  if (!redisClient) {
    redisClient = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    redisClient.on('error', (err: Error) => {
      logger.error({ err }, 'Rate-limit Redis connection error');
    });
  }
  return redisClient;
}

/**
 * Shared counters across every replica when RATE_LIMIT_REDIS_URL is set —
 * see the production-readiness audit's finding that express-rate-limit's
 * default in-memory store makes every replica count independently,
 * silently multiplying the effective limit (including the login
 * brute-force guard) by replica count. Returns undefined when unset, which
 * makes express-rate-limit fall back to its own in-memory store — the
 * right default for a single local instance.
 */
export function createRateLimitStore(prefix: string): Store | undefined {
  const env = loadEnv();
  if (!env.RATE_LIMIT_REDIS_URL) {
    return undefined;
  }
  return new RedisStore({
    prefix: `bankops:rl:${prefix}:`,
    sendCommand: (...args: string[]) => {
      const [command, ...rest] = args;
      return getRedisClient(env.RATE_LIMIT_REDIS_URL!).call(command!, ...rest) as Promise<never>;
    },
  });
}
