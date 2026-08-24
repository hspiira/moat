import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

async function load() {
  return import("@/lib/preferences/lock-timeout");
}

describe("the lock timeout preference", () => {
  it("locks after five minutes until someone says otherwise", async () => {
    stubStorage();
    const { readLockTimeout, DEFAULT_LOCK_TIMEOUT } = await load();

    expect(readLockTimeout()).toBe(DEFAULT_LOCK_TIMEOUT);
    expect(DEFAULT_LOCK_TIMEOUT).toBe(5);
  });

  it("remembers a choice", async () => {
    stubStorage();
    const { readLockTimeout, writeLockTimeout } = await load();

    writeLockTimeout(15);

    expect(readLockTimeout()).toBe(15);
  });

  it("keeps locking when the stored value is nonsense", async () => {
    const store = stubStorage();
    const { readLockTimeout, DEFAULT_LOCK_TIMEOUT } = await load();

    store.set("moat.lock-timeout-minutes", "not-a-number");
    expect(readLockTimeout()).toBe(DEFAULT_LOCK_TIMEOUT);

    store.set("moat.lock-timeout-minutes", "999999");
    expect(readLockTimeout()).toBe(DEFAULT_LOCK_TIMEOUT);
  });

  it("takes zero to mean lock on leaving, not never", async () => {
    stubStorage();
    const { readLockTimeout, writeLockTimeout, lockTimeoutMs } = await load();

    writeLockTimeout(0);

    expect(readLockTimeout()).toBe(0);
    expect(lockTimeoutMs(0)).toBeGreaterThan(0);
  });

  it("never offers a choice that would leave the app open for good", async () => {
    stubStorage();
    const { isLockTimeout, lockTimeoutMs, LOCK_TIMEOUT_CHOICES } = await load();

    for (const choice of LOCK_TIMEOUT_CHOICES) {
      expect(isLockTimeout(choice)).toBe(true);
      expect(lockTimeoutMs(choice)).toBeGreaterThan(0);
    }
    expect(isLockTimeout(-1)).toBe(false);
    expect(isLockTimeout(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("says each choice in words", async () => {
    stubStorage();
    const { describeLockTimeout } = await load();

    expect(describeLockTimeout(0)).toBe("Immediately");
    expect(describeLockTimeout(1)).toBe("After 1 minute");
    expect(describeLockTimeout(5)).toBe("After 5 minutes");
    expect(describeLockTimeout(60)).toBe("After 1 hour");
  });
});
