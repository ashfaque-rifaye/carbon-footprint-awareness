/**
 * Rate limiting — a tiny, dependency-free fixed-window limiter.
 *
 * Used to throttle abuse of the public auth endpoints (brute-force login,
 * registration spam). Pure and time-injectable so it is unit-testable without
 * timers. State is in-process (sufficient for this app's single warm instance);
 * a distributed deployment would back this with a shared store.
 */
export interface RateLimitOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed hits per key within the window. */
  max: number;
}

export interface RateLimiter {
  /** Returns true if the hit is allowed, false if the key is over its limit. */
  check(key: string, now?: number): boolean;
}

export function createRateLimiter({ windowMs, max }: RateLimitOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
