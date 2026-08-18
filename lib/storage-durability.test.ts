import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensurePersistentStorage,
  isEvictable,
  isRunningLowOnSpace,
  readStorageDurability,
} from "@/lib/storage-durability";

const original = globalThis.navigator;

function stubStorage(storage: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value: storage === null ? {} : { storage },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: original,
    configurable: true,
    writable: true,
  });
});

describe("ensurePersistentStorage", () => {
  it("asks for persistence when the origin is still evictable", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist,
      estimate: vi.fn().mockResolvedValue({ usage: 1_000, quota: 10_000 }),
    });

    const result = await ensurePersistentStorage();
    expect(persist).toHaveBeenCalledOnce();
    expect(result.state).toBe("persisted");
    expect(result.usedFraction).toBeCloseTo(0.1);
  });

  it("does not ask again once granted", async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    expect((await ensurePersistentStorage()).state).toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports best-effort when the browser refuses, and does not throw", async () => {
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });

    const result = await ensurePersistentStorage();
    expect(result.state).toBe("best-effort");
    expect(isEvictable(result)).toBe(true);
  });

  it("survives a browser that throws", async () => {
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error("denied")) });
    expect((await ensurePersistentStorage()).state).toBe("unknown");
  });

  // An unsupported browser must not read as "your data is evictable".
  it("says unknown rather than guessing when the API is absent", async () => {
    stubStorage(null);
    const result = await ensurePersistentStorage();
    expect(result.state).toBe("unknown");
    expect(isEvictable(result)).toBe(false);
  });

  it("copes with a browser that reports no quota", async () => {
    stubStorage({
      persisted: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockResolvedValue({}),
    });
    const result = await readStorageDurability();
    expect(result.usedFraction).toBeNull();
    expect(isRunningLowOnSpace(result)).toBe(false);
  });
});

describe("isRunningLowOnSpace", () => {
  it("warns at four fifths of the quota", () => {
    const at = (usedFraction: number) =>
      isRunningLowOnSpace({ state: "persisted", usedFraction, usedBytes: 1, quotaBytes: 1 });

    expect(at(0.79)).toBe(false);
    expect(at(0.8)).toBe(true);
    expect(at(0.97)).toBe(true);
  });
});
