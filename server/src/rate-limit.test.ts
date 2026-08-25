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

  /* A sweep only reclaims what expired, so on its own it cannot answer a caller
     opening keys faster than the window retires them. Before the cap, this grew
     past the sweep threshold and then walked every key on every later request. */
  it("holds at the cap while a caller rotates its key inside one window", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 100 });

    for (let index = 0; index < 5_000; index += 1) {
      limiter.check(`key-${index}`, 0);
    }

    expect(limiter.size()).toBeLessThanOrEqual(100);
  });

  it("clears what expired once the window has passed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 100 });

    for (let index = 0; index < 50; index += 1) {
      limiter.check(`key-${index}`, 0);
    }

    limiter.check("later", 2_000);

    expect(limiter.size()).toBe(1);
  });

  it("keeps counting a caller that stays on one key while others churn", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, maxKeys: 100 });

    expect(limiter.check("steady", 0).allowed).toBe(true);
    expect(limiter.check("steady", 1).allowed).toBe(true);

    expect(limiter.check("steady", 2).allowed).toBe(false);
  });
});
