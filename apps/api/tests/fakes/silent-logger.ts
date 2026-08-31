import type { Logger } from 'pino';

/** A `pino`-shaped logger that does nothing — unit tests shouldn't print. */
export function createSilentLogger(): Logger {
  const noop = (): void => {};
  const logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => logger,
  } as unknown as Logger;
  return logger;
}
