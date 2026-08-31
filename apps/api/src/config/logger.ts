import pino from 'pino';
import { loadEnv } from './env.js';

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
});
