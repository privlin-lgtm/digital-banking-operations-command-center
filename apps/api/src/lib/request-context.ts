import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Correlation IDs, done so every log line gets one — not just the
 * request/response access log pino-http already writes.
 *
 * Without this, `req.log.info(...)` inside a route handler carries the
 * request id, but a plain `this.logger.info(...)` call three layers down
 * in a service (which has no `req` — that's the point of keeping business
 * logic framework-free) does not. AsyncLocalStorage threads the id through
 * every `await` in the call chain without passing it as a parameter
 * anywhere; `config/logger.ts` reads it back via pino's `mixin` option, so
 * every log call — service, repository, background sweep — picks it up
 * automatically for the lifetime of one request.
 */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
