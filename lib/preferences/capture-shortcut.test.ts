import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addCaptureShortcutSender,
  canAddCaptureShortcutSender,
  defaultCaptureShortcutPreferences,
  removeCaptureShortcutSender,
} from "@/lib/preferences/capture-shortcut";

afterEach(() => {
  vi.unstubAllGlobals();
});

const empty = defaultCaptureShortcutPreferences;

describe("addCaptureShortcutSender", () => {
  it("adds a sender to an empty list", () => {
    expect(addCaptureShortcutSender(empty, "MTN MoMo").senders).toEqual(["MTN MoMo"]);
  });

  it("keeps them in the order they were added", () => {
    const withTwo = addCaptureShortcutSender(addCaptureShortcutSender(empty, "MTN"), "Stanbic");

    expect(withTwo.senders).toEqual(["MTN", "Stanbic"]);
  });

  it("trims what was typed", () => {
    expect(addCaptureShortcutSender(empty, "  MTN MoMo  ").senders).toEqual(["MTN MoMo"]);
  });

  it("ignores a name that is only spaces", () => {
    expect(addCaptureShortcutSender(empty, "   ").senders).toEqual([]);
  });

  /* One bank typed two ways is still one sender, and a duplicate would put the
     same name in the instructions twice. */
  it("does not add a sender that is already there under another spelling", () => {
    const once = addCaptureShortcutSender(empty, "MTN MoMo");

    expect(addCaptureShortcutSender(once, "mtn momo").senders).toEqual(["MTN MoMo"]);
    expect(addCaptureShortcutSender(once, "  MTN MOMO ").senders).toEqual(["MTN MoMo"]);
  });

  it("keeps the spelling that was added first", () => {
    const once = addCaptureShortcutSender(empty, "MTN MoMo");

    expect(addCaptureShortcutSender(once, "MTN momo").senders[0]).toBe("MTN MoMo");
  });

  /* The list shares a store with the ledger, so it cannot grow without end. */
  it("stops at the cap rather than growing without end", () => {
    let preferences = empty;
    for (let index = 0; index < 40; index += 1) {
      preferences = addCaptureShortcutSender(preferences, `Sender ${index}`);
    }

    expect(preferences.senders).toHaveLength(20);
    expect(canAddCaptureShortcutSender(preferences)).toBe(false);
  });

  it("leaves the list untouched rather than replacing its last entry at the cap", () => {
    let preferences = empty;
    for (let index = 0; index < 20; index += 1) {
      preferences = addCaptureShortcutSender(preferences, `Sender ${index}`);
    }

    expect(addCaptureShortcutSender(preferences, "One too many").senders).toEqual(
      preferences.senders,
    );
  });

  it("does not change the list it was given", () => {
    const before = addCaptureShortcutSender(empty, "MTN");
    addCaptureShortcutSender(before, "Stanbic");

    expect(before.senders).toEqual(["MTN"]);
  });
});

describe("removeCaptureShortcutSender", () => {
  it("removes a sender however it is spelled", () => {
    const withTwo = addCaptureShortcutSender(addCaptureShortcutSender(empty, "MTN"), "Stanbic");

    expect(removeCaptureShortcutSender(withTwo, "mtn").senders).toEqual(["Stanbic"]);
  });

  it("leaves the list alone when the sender is not on it", () => {
    const once = addCaptureShortcutSender(empty, "MTN");

    expect(removeCaptureShortcutSender(once, "Absa").senders).toEqual(["MTN"]);
  });
});

describe("readCaptureShortcutPreferences", () => {
  it("reads back what was saved", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });

    const { readCaptureShortcutPreferences, saveCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    saveCaptureShortcutPreferences({ senders: ["MTN MoMo"] });

    expect(readCaptureShortcutPreferences().senders).toEqual(["MTN MoMo"]);
  });

  it("reads an empty list when nothing was ever saved", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {} } });

    const { readCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(readCaptureShortcutPreferences().senders).toEqual([]);
  });

  /* Nothing outside this app writes the key, but a half-written or hand-edited
     store must not take the settings screen down with it. */
  it("reads an empty list rather than throwing on a store it cannot parse", async () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => "{not json", setItem: () => {} },
    });

    const { readCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(readCaptureShortcutPreferences().senders).toEqual([]);
  });

  it("drops entries that are not names", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify({ senders: ["MTN", 7, null, "Stanbic"] }),
        setItem: () => {},
      },
    });

    const { readCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(readCaptureShortcutPreferences().senders).toEqual(["MTN", "Stanbic"]);
  });

  it("does not throw when the store refuses the write", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });

    const { saveCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(() => saveCaptureShortcutPreferences({ senders: ["MTN"] })).not.toThrow();
  });
});
