import { describe, expect, it, vi } from 'vitest';
import { RetryExhaustedError, withRetry } from '../../src/modules/remediation/retry.js';

const noSleep = async (): Promise<void> => {
  // No-op sleep — makes the exponential backoff delays instant in tests.
};

describe('withRetry', () => {
  it('returns the result on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      sleep: noSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and succeeds on a later attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      sleep: noSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and throws RetryExhaustedError', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, sleep: noSleep }),
    ).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry says no', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('not retryable'));

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially between attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fails'));
    const delays: number[] = [];
    const recordingSleep = async (ms: number): Promise<void> => {
      delays.push(ms);
    };

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
        sleep: recordingSleep,
      }),
    ).rejects.toThrow(RetryExhaustedError);

    // 4 attempts -> 3 waits between them: 100, 200, 400 (no jitter here).
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps the backoff at maxDelayMs', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fails'));
    const delays: number[] = [];
    const recordingSleep = async (ms: number): Promise<void> => {
      delays.push(ms);
    };

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 300, sleep: recordingSleep }),
    ).rejects.toThrow(RetryExhaustedError);

    expect(delays).toEqual([100, 200, 300, 300]);
  });
});
