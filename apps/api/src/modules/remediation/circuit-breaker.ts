export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Consecutive failures (while CLOSED) before the circuit trips OPEN. */
  failureThreshold: number;
  /** How long the circuit stays OPEN before allowing one trial request through (HALF_OPEN). */
  resetTimeoutMs: number;
  /** Consecutive successes required in HALF_OPEN before the circuit fully closes. */
  halfOpenSuccessesToClose: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit "${circuitName}" is open — refusing to call the dependency`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Fails fast instead of piling up calls against a dependency that's
 * already down. CLOSED lets calls through and counts consecutive
 * failures; enough of them trips it OPEN, where every call is rejected
 * immediately (no network round-trip, no timeout to wait out) until
 * `resetTimeoutMs` elapses. Then exactly one trial call is allowed
 * through (HALF_OPEN) — succeed enough of those and the breaker closes;
 * fail one and it snaps back OPEN for another full timeout.
 *
 * Time is passed into `execute()` rather than read from `Date.now()`
 * internally so tests can drive the state machine with fake clocks
 * instead of real timers.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {}

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>, now: number = Date.now()): Promise<T> {
    if (this.state === 'OPEN') {
      if (now - this.openedAt < this.options.resetTimeoutMs) {
        throw new CircuitBreakerOpenError(this.name);
      }
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(now);
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== 'HALF_OPEN') {
      return;
    }
    this.consecutiveSuccesses += 1;
    if (this.consecutiveSuccesses >= this.options.halfOpenSuccessesToClose) {
      this.state = 'CLOSED';
      this.consecutiveSuccesses = 0;
    }
  }

  private onFailure(now: number): void {
    this.consecutiveSuccesses = 0;
    if (this.state === 'HALF_OPEN') {
      // A trial call in HALF_OPEN failed — back to OPEN immediately, no
      // second chance, for another full reset window.
      this.state = 'OPEN';
      this.openedAt = now;
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }
}
