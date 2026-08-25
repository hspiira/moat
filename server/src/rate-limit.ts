export type RateLimitRule = {
  limit: number;
  windowMs: number;
  maxKeys?: number;
};

export type RateLimitVerdict = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type Window = {
  count: number;
  resetAt: number;
};

const DEFAULT_MAX_KEYS = 10_000;

// Kept in memory on purpose: this is one process, and a limit that survives a
// restart would need a store of its own for no gain here. Restarting resets the
// counters, which is the cost of that simplicity.
export function createRateLimiter(rule: RateLimitRule) {
  const windows = new Map<string, Window>();
  const maxKeys = rule.maxKeys ?? DEFAULT_MAX_KEYS;
  let nextSweepAt = Number.NEGATIVE_INFINITY;

  function sweep(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    nextSweepAt = now + rule.windowMs;
  }

  // A sweep only reclaims what has expired, so it cannot bound a caller opening
  // keys faster than they expire. The cap is what does that, and it evicts in
  // insertion order because every window is the same length, which makes the
  // oldest key the one nearest to expiring anyway.
  function makeRoom(now: number) {
    if (windows.size < maxKeys) return;

    sweep(now);

    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    check(key: string, now: number): RateLimitVerdict {
      // Once per window rather than on every call past a size threshold, which
      // turned each request into a walk of every key a caller had opened.
      if (now >= nextSweepAt) sweep(now);

      const window = windows.get(key);

      if (!window || window.resetAt <= now) {
        makeRoom(now);
        windows.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (window.count >= rule.limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
        };
      }

      window.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },

    size() {
      return windows.size;
    },
  };
}
