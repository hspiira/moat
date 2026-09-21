import { afterEach, describe, expect, it, vi } from "vitest";

import {
  accountIdForSender,
  addCaptureShortcutSender,
  captureShortcutSenderNames,
  setCaptureShortcutSenderAccount,
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
    expect(addCaptureShortcutSender(empty, "MTN MoMo").senders).toEqual([{ name: "MTN MoMo" }]);
  });

  it("keeps them in the order they were added", () => {
    const withTwo = addCaptureShortcutSender(addCaptureShortcutSender(empty, "MTN"), "Stanbic");

    expect(withTwo.senders).toEqual([{ name: "MTN" }, { name: "Stanbic" }]);
  });

  it("trims what was typed", () => {
    expect(addCaptureShortcutSender(empty, "  MTN MoMo  ").senders).toEqual([{ name: "MTN MoMo" }]);
  });

  it("ignores a name that is only spaces", () => {
    expect(addCaptureShortcutSender(empty, "   ").senders).toEqual([]);
  });

  /* One bank typed two ways is still one sender, and a duplicate would put the
     same name in the instructions twice. */
  it("does not add a sender that is already there under another spelling", () => {
    const once = addCaptureShortcutSender(empty, "MTN MoMo");

    expect(addCaptureShortcutSender(once, "mtn momo").senders).toEqual([{ name: "MTN MoMo" }]);
    expect(addCaptureShortcutSender(once, "  MTN MOMO ").senders).toEqual([{ name: "MTN MoMo" }]);
  });

  it("keeps the spelling that was added first", () => {
    const once = addCaptureShortcutSender(empty, "MTN MoMo");

    expect(addCaptureShortcutSender(once, "MTN momo").senders[0].name).toBe("MTN MoMo");
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

    expect(before.senders).toEqual([{ name: "MTN" }]);
  });
});

describe("removeCaptureShortcutSender", () => {
  it("removes a sender however it is spelled", () => {
    const withTwo = addCaptureShortcutSender(addCaptureShortcutSender(empty, "MTN"), "Stanbic");

    expect(removeCaptureShortcutSender(withTwo, "mtn").senders).toEqual([{ name: "Stanbic" }]);
  });

  it("leaves the list alone when the sender is not on it", () => {
    const once = addCaptureShortcutSender(empty, "MTN");

    expect(removeCaptureShortcutSender(once, "Absa").senders).toEqual([{ name: "MTN" }]);
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

    saveCaptureShortcutPreferences({ senders: [{ name: "MTN MoMo" }] });

    expect(readCaptureShortcutPreferences().senders).toEqual([{ name: "MTN MoMo" }]);
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

    expect(readCaptureShortcutPreferences().senders).toEqual([{ name: "MTN" }, { name: "Stanbic" }]);
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

    expect(() => saveCaptureShortcutPreferences({ senders: [{ name: "MTN" }] })).not.toThrow();
  });
});

describe("sender accounts", () => {
  const withSenders = addCaptureShortcutSender(
    addCaptureShortcutSender(defaultCaptureShortcutPreferences, "MTNMobMoney"),
    "AirtelMoney",
  );

  it("holds no account until one is chosen", () => {
    expect(accountIdForSender(withSenders, "MTNMobMoney")).toBeUndefined();
  });

  /* A sender is not spelled the way an account is named, so the account it
     belongs on is held rather than read out of the name. */
  it("remembers the account chosen for a sender", () => {
    const mapped = setCaptureShortcutSenderAccount(withSenders, "MTNMobMoney", "account:momo");

    expect(accountIdForSender(mapped, "MTNMobMoney")).toBe("account:momo");
    expect(accountIdForSender(mapped, "AirtelMoney")).toBeUndefined();
  });

  it("answers whatever way the sender is written", () => {
    const mapped = setCaptureShortcutSenderAccount(withSenders, "MTNMobMoney", "account:momo");

    expect(accountIdForSender(mapped, "mtnmobmoney")).toBe("account:momo");
    expect(accountIdForSender(mapped, "  MTNMobMoney  ")).toBe("account:momo");
  });

  it("clears the account again", () => {
    const mapped = setCaptureShortcutSenderAccount(withSenders, "MTNMobMoney", "account:momo");

    expect(accountIdForSender(setCaptureShortcutSenderAccount(mapped, "MTNMobMoney", undefined), "MTNMobMoney"))
      .toBeUndefined();
  });

  it("keeps the account when the list is added to", () => {
    const mapped = setCaptureShortcutSenderAccount(withSenders, "MTNMobMoney", "account:momo");

    expect(accountIdForSender(addCaptureShortcutSender(mapped, "Centenary"), "MTNMobMoney"))
      .toBe("account:momo");
  });

  it("answers nothing for a sender it has never heard of", () => {
    expect(accountIdForSender(withSenders, "Stanbic")).toBeUndefined();
    expect(accountIdForSender(withSenders, undefined)).toBeUndefined();
  });

  it("lists the names for the recipe", () => {
    expect(captureShortcutSenderNames(withSenders)).toEqual(["MTNMobMoney", "AirtelMoney"]);
  });
});

describe("reading a list saved before accounts existed", () => {
  /* The list held plain names first. A device that stored them must keep
     working rather than lose every sender on an update. */
  it("reads plain names as senders with no account", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify({ senders: ["MTN MoMo", "Centenary"] }),
        setItem: () => {},
      },
    });

    const { readCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(readCaptureShortcutPreferences().senders).toEqual([
      { name: "MTN MoMo" },
      { name: "Centenary" },
    ]);
  });

  it("drops entries that name nothing", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () =>
          JSON.stringify({ senders: ["MTN", "", 7, null, { accountId: "a" }, { name: "Ok" }] }),
        setItem: () => {},
      },
    });

    const { readCaptureShortcutPreferences } = await import(
      "@/lib/preferences/capture-shortcut"
    );

    expect(readCaptureShortcutPreferences().senders).toEqual([{ name: "MTN" }, { name: "Ok" }]);
  });
});
