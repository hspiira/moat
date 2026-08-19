import { afterEach, describe, expect, it } from "vitest";

import {
  clearStorageNotice,
  dismissStorageNotice,
  isStorageNoticeDismissed,
} from "@/lib/preferences/storage-notice";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  },
  configurable: true,
  writable: true,
});

afterEach(() => store.clear());

describe("storage notice", () => {
  it("starts undismissed", () => {
    expect(isStorageNoticeDismissed("evictable")).toBe(false);
  });

  it("stays dismissed once dismissed", () => {
    dismissStorageNotice("evictable");
    expect(isStorageNoticeDismissed("evictable")).toBe(true);
  });

  it("dismisses each notice separately, so running low still speaks up", () => {
    dismissStorageNotice("evictable");
    expect(isStorageNoticeDismissed("low-space")).toBe(false);
  });

  it("speaks up again once a notice is cleared", () => {
    dismissStorageNotice("stale-backup");
    clearStorageNotice("stale-backup");
    expect(isStorageNoticeDismissed("stale-backup")).toBe(false);
  });
});
