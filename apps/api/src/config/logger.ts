import pino from 'pino';
import { loadEnv } from './env.js';
import { getRequestId } from '../lib/request-context.js';

export const logger = pino({
  level: loadEnv().LOG_LEVEL,
  ...(loadEnv().NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash'],
    censor: '[REDACTED]',
  },
  // Runs on every log call this logger (or a .child() of it) makes and
  // merges the result into the log object — the mechanism that gets a
  // correlation ID onto a plain `logger.info(...)` call inside a service,
  // with no `req` in scope and no call site changed. See lib/request-context.ts.
  mixin() {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
});
