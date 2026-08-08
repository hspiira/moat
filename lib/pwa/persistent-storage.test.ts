import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isStoragePersisted,
  requestPersistentStorage,
} from "@/lib/pwa/persistent-storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(storage: unknown) {
  vi.stubGlobal("navigator", storage === undefined ? {} : { storage });
}

describe("requestPersistentStorage", () => {
  it("reports unsupported when the browser has no storage manager", () => {
    stubStorage(undefined);

    return expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("reports unsupported when persist is missing", () => {
    stubStorage({ persisted: async () => false });

    return expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("reports persisted when the browser grants the request", async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => false });

    await expect(requestPersistentStorage()).resolves.toBe("persisted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports denied when the browser refuses", () => {
    stubStorage({ persist: async () => false, persisted: async () => false });

    return expect(requestPersistentStorage()).resolves.toBe("denied");
  });

  it("does not ask again when storage is already persisted", async () => {
    // Safari prompts on a repeat persist() call, so a granted state must be
    // read rather than re-requested on every launch.
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => true });

    await expect(requestPersistentStorage()).resolves.toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("treats a throwing browser as a refusal", () => {
    stubStorage({
      persist: async () => {
        throw new Error("not allowed");
      },
      persisted: async () => false,
    });

    return expect(requestPersistentStorage()).resolves.toBe("denied");
  });
});

describe("isStoragePersisted", () => {
  it("reports unsupported when the browser cannot say", () => {
    stubStorage({ persist: async () => true });

    return expect(isStoragePersisted()).resolves.toBe("unsupported");
  });

  it("reads the current state without requesting it", async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => true });

    await expect(isStoragePersisted()).resolves.toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports denied when storage is evictable", () => {
    stubStorage({ persist: async () => true, persisted: async () => false });

    return expect(isStoragePersisted()).resolves.toBe("denied");
  });
});
