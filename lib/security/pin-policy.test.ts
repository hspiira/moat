import { describe, expect, it } from "vitest";

import {
  INITIAL_ATTEMPT_STATE,
  MIN_PIN_LENGTH,
  getLockoutDurationMs,
  getRemainingLockoutMs,
  isValidPin,
  readAttemptState,
  recordFailedAttempt,
  writeAttemptState,
} from "@/lib/security/pin-policy";

describe("pin validity", () => {
  it("requires at least six digits", () => {
    expect(MIN_PIN_LENGTH).toBe(6);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(isValidPin("abcdef")).toBe(false);
    expect(isValidPin("12345a")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("unlock throttling", () => {
  it("allows the first five attempts without lockout", () => {
    let state = INITIAL_ATTEMPT_STATE;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      state = recordFailedAttempt(state, 1_000 + attempt);
      expect(getRemainingLockoutMs(state, 1_000 + attempt)).toBe(0);
    }
  });

  it("locks out for 30 seconds after the fifth failure and escalates", () => {
    expect(getLockoutDurationMs(5)).toBe(30_000);
    expect(getLockoutDurationMs(6)).toBe(60_000);
    expect(getLockoutDurationMs(7)).toBe(120_000);
  });

  it("caps the lockout at 15 minutes", () => {
    expect(getLockoutDurationMs(50)).toBe(15 * 60 * 1000);
  });

  it("counts down the remaining lockout as time passes", () => {
    let state = INITIAL_ATTEMPT_STATE;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      state = recordFailedAttempt(state, 10_000);
    }

    expect(getRemainingLockoutMs(state, 10_000)).toBe(30_000);
    expect(getRemainingLockoutMs(state, 25_000)).toBe(15_000);
    expect(getRemainingLockoutMs(state, 40_000)).toBe(0);
  });
});

describe("attempt state persistence", () => {
  function createMemoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      size: () => values.size,
    };
  }

  it("round-trips attempt state through storage", () => {
    const storage = createMemoryStorage();
    const state = recordFailedAttempt(INITIAL_ATTEMPT_STATE, 5_000);

    writeAttemptState(storage, state);
    expect(readAttemptState(storage)).toEqual(state);
  });

  it("clears storage when attempts reset to zero", () => {
    const storage = createMemoryStorage();
    writeAttemptState(storage, recordFailedAttempt(INITIAL_ATTEMPT_STATE, 5_000));
    writeAttemptState(storage, INITIAL_ATTEMPT_STATE);

    expect(storage.size()).toBe(0);
    expect(readAttemptState(storage)).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it("falls back to the initial state on corrupt storage", () => {
    const storage = createMemoryStorage();
    storage.setItem("moat:pin_attempts", "not json");

    expect(readAttemptState(storage)).toEqual(INITIAL_ATTEMPT_STATE);
  });
});
