/**
 * Fallback strategy: when the primary path is exhausted (retries used up,
 * circuit open), degrade to something safe instead of surfacing a raw
 * failure. The fallback itself is never retried — if the safety net also
 * fails, that failure is what the caller should see.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch {
    return fallback();
  }
}
