import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("allows up to the limit inside one window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1_000 });

    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 100).allowed).toBe(true);
    expect(limiter.check("a", 200).allowed).toBe(true);
    expect(limiter.check("a", 300).allowed).toBe(false);
  });

  it("says how long to wait, never zero", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 5_000 });
    limiter.check("a", 0);

    expect(limiter.check("a", 4_900).retryAfterSeconds).toBe(1);
    expect(limiter.check("a", 1_000).retryAfterSeconds).toBe(4);
  });

  it("lets a caller through again once the window has passed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 500).allowed).toBe(false);
    expect(limiter.check("a", 1_000).allowed).toBe(true);
  });

  it("counts each caller on its own", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 0).allowed).toBe(false);
  });

  it("does not grow without bound when a caller rotates its key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    for (let index = 0; index < 10_002; index += 1) {
      limiter.check(`key-${index}`, 0);
    }
    expect(limiter.size()).toBeGreaterThan(10_000);

    // A later request past the window clears what expired rather than piling up.
    limiter.check("later", 2_000);
    expect(limiter.size()).toBe(1);
  });
});
