export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Full jitter (random 0..delay) instead of a fixed delay — spreads out retries from many callers instead of having them all retry in lockstep. */
  jitter?: boolean;
  /** Injectable so tests run instantly instead of waiting on real timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Return false for errors that retrying can never fix (e.g. a 400/validation error) — defaults to "retry everything". */
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryExhaustedError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(
      `Gave up after ${attempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
    this.name = 'RetryExhaustedError';
  }
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff: attempt 1 waits ~baseDelayMs, attempt 2 waits
 * ~2x that, attempt 3 ~4x, capped at maxDelayMs — a transient blip gets
 * retried almost immediately, but a call that keeps failing backs off
 * instead of hammering an already-struggling dependency.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? realSleep;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts || !shouldRetry(error)) {
        throw new RetryExhaustedError(attempt, error);
      }
      const backoff = Math.min(options.baseDelayMs * 2 ** (attempt - 1), options.maxDelayMs);
      const delay = options.jitter ? Math.random() * backoff : backoff;
      await sleep(delay);
    }
  }

  // Unreachable — the loop above always either returns or throws — but
  // keeps the function's return type honest without a non-null assertion.
  throw new RetryExhaustedError(options.maxAttempts, lastError);
}
