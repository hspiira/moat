export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export type RateLimitVerdict = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type Window = {
  count: number;
  resetAt: number;
};

// Kept in memory on purpose: this is one process, and a limit that survives a
// restart would need a store of its own for no gain here. Restarting resets the
// counters, which is the cost of that simplicity.
export function createRateLimiter(rule: RateLimitRule) {
  const windows = new Map<string, Window>();

  function sweep(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  return {
    check(key: string, now: number): RateLimitVerdict {
      // A caller rotating keys would otherwise grow this map without bound, so
      // expired windows are cleared once it is worth the walk.
      if (windows.size > 10_000) sweep(now);

      const window = windows.get(key);

      if (!window || window.resetAt <= now) {
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
