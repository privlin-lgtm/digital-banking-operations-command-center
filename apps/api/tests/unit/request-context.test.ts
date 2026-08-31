import { describe, expect, it } from 'vitest';
import { getRequestId, runWithRequestContext } from '../../src/lib/request-context.js';

describe('request-context', () => {
  it('returns undefined outside of any request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('makes the request id available anywhere in the same async call chain', async () => {
    await runWithRequestContext({ requestId: 'req-123' }, async () => {
      expect(getRequestId()).toBe('req-123');

      // Simulates a service/repository call several `await`s deep — the
      // whole point of AsyncLocalStorage is that this still sees it
      // without the id being passed as a parameter anywhere.
      async function threeAwaitsDeep(): Promise<string | undefined> {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        return getRequestId();
      }

      expect(await threeAwaitsDeep()).toBe('req-123');
    });
  });

  it('isolates concurrent contexts from each other', async () => {
    const results = await Promise.all([
      runWithRequestContext({ requestId: 'req-A' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getRequestId();
      }),
      runWithRequestContext({ requestId: 'req-B' }, async () => {
        return getRequestId();
      }),
    ]);

    expect(results).toEqual(['req-A', 'req-B']);
  });
});
