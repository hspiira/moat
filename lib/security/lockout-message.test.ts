import { describe, expect, it } from "vitest";

import { formatLockoutMessage } from "@/lib/security/lockout-message";

describe("formatLockoutMessage", () => {
  it("counts in seconds under a minute", () => {
    expect(formatLockoutMessage(30_000)).toBe("Too many attempts. Try again in 30s.");
  });

  it("rounds up, so it never tells you to try again now", () => {
    expect(formatLockoutMessage(1)).toBe("Too many attempts. Try again in 1s.");
    expect(formatLockoutMessage(30_400)).toBe("Too many attempts. Try again in 31s.");
  });

  it("counts in minutes once a minute is reached", () => {
    expect(formatLockoutMessage(60_000)).toBe("Too many attempts. Try again in 1 minute.");
  });

  it("says minutes, not minutes, for more than one", () => {
    expect(formatLockoutMessage(150_000)).toBe("Too many attempts. Try again in 3 minutes.");
  });
});
