import { describe, expect, it } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from '../../src/modules/remediation/circuit-breaker.js';

const OPTIONS = { failureThreshold: 3, resetTimeoutMs: 10_000, halfOpenSuccessesToClose: 2 };

const ok = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('boom'));

describe('CircuitBreaker', () => {
  it('stays CLOSED and lets calls through while failures stay under the threshold', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow('boom');
    await expect(breaker.execute(fail, 1)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('trips OPEN once consecutive failures reach the threshold', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow();
    await expect(breaker.execute(fail, 1)).rejects.toThrow();
    await expect(breaker.execute(fail, 2)).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');
  });

  it('rejects immediately with CircuitBreakerOpenError while OPEN, without calling the function', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow();
    await expect(breaker.execute(fail, 1)).rejects.toThrow();
    await expect(breaker.execute(fail, 2)).rejects.toThrow();

    let called = false;
    await expect(
      breaker.execute(() => {
        called = true;
        return ok();
      }, 3), // still well within resetTimeoutMs of when it opened (t=2)
    ).rejects.toThrow(CircuitBreakerOpenError);
    expect(called).toBe(false);
  });

  it('allows one trial call through as HALF_OPEN once resetTimeoutMs has elapsed', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow();
    await expect(breaker.execute(fail, 1)).rejects.toThrow();
    await expect(breaker.execute(fail, 2)).rejects.toThrow(); // opens at t=2

    const result = await breaker.execute(ok, 2 + OPTIONS.resetTimeoutMs + 1);
    expect(result).toBe('ok');
    // halfOpenSuccessesToClose is 2 — one success isn't enough to fully close yet.
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('closes after enough consecutive successes in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow();
    await expect(breaker.execute(fail, 1)).rejects.toThrow();
    await expect(breaker.execute(fail, 2)).rejects.toThrow();

    const t = 2 + OPTIONS.resetTimeoutMs + 1;
    await breaker.execute(ok, t);
    await breaker.execute(ok, t + 1);
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('snaps back to OPEN if the HALF_OPEN trial call fails', async () => {
    const breaker = new CircuitBreaker('test', OPTIONS);
    await expect(breaker.execute(fail, 0)).rejects.toThrow();
    await expect(breaker.execute(fail, 1)).rejects.toThrow();
    await expect(breaker.execute(fail, 2)).rejects.toThrow();

    const t = 2 + OPTIONS.resetTimeoutMs + 1;
    await expect(breaker.execute(fail, t)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('OPEN');

    // And it's rejecting fast again immediately after re-opening.
    await expect(breaker.execute(ok, t + 1)).rejects.toThrow(CircuitBreakerOpenError);
  });
});
