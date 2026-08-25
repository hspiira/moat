import { afterEach, describe, expect, it, vi } from "vitest";

import { toNativeCapturePayload, toNativeCapturePayloads } from "./capture-intent-bridge";

describe("toNativeCapturePayload", () => {
  it("turns a queued capture into a shared-text payload", () => {
    expect(
      toNativeCapturePayload({
        message: "Sent UGX 5,000 to Grocery",
        sender: "MTN MoMo",
        occurredAt: "2026-04-07T10:00:00.000Z",
      }),
    ).toEqual({
      channel: "shared_text",
      source: "shared_text",
      rawContent: "Sent UGX 5,000 to Grocery",
      sourceTitle: "MTN MoMo",
      occurredAt: "2026-04-07T10:00:00.000Z",
    });
  });

  it("trims what the action passed through", () => {
    expect(
      toNativeCapturePayload({ message: "  Sent UGX 5,000  ", sender: "  MTN  " }),
    ).toMatchObject({ rawContent: "Sent UGX 5,000", sourceTitle: "MTN" });
  });

  it("drops a capture with no message to read", () => {
    expect(toNativeCapturePayload({ message: "   " })).toBeNull();
    expect(toNativeCapturePayload({})).toBeNull();
    expect(toNativeCapturePayload({ message: 7 })).toBeNull();
  });

  it("takes no sender rather than a blank one", () => {
    expect(toNativeCapturePayload({ message: "Sent UGX 5,000", sender: "  " })?.sourceTitle)
      .toBeUndefined();
    expect(toNativeCapturePayload({ message: "Sent UGX 5,000", sender: 7 })?.sourceTitle)
      .toBeUndefined();
  });

  /* Checked the same way the url route is checked. Arriving through a native
     call says nothing about who wrote it: a Shortcut built it either way. */
  it("keeps the message and drops a moment it cannot read", () => {
    const payload = toNativeCapturePayload({
      message: "Sent UGX 5,000",
      occurredAt: "sometime yesterday",
    });

    expect(payload?.rawContent).toBe("Sent UGX 5,000");
    expect(payload?.occurredAt).toBeUndefined();
  });
});

describe("toNativeCapturePayloads", () => {
  it("keeps the order the messages were queued in", () => {
    const payloads = toNativeCapturePayloads([
      { message: "first" },
      { message: "second" },
      { message: "third" },
    ]);

    expect(payloads.map((entry) => entry.rawContent)).toEqual(["first", "second", "third"]);
  });

  /* One unreadable entry must not cost the rest of the queue: they are separate
     messages that happened to be drained together. */
  it("keeps the readable entries when one is not", () => {
    expect(
      toNativeCapturePayloads([
        { message: "kept" },
        { message: "" },
        null,
        "not an object",
        { sender: "no message" },
        { message: "also kept" },
      ]).map((entry) => entry.rawContent),
    ).toEqual(["kept", "also kept"]);
  });

  it("reads nothing out of what is not a list", () => {
    expect(toNativeCapturePayloads(undefined)).toEqual([]);
    expect(toNativeCapturePayloads(null)).toEqual([]);
    expect(toNativeCapturePayloads({ payloads: [] })).toEqual([]);
  });

  it("reads nothing out of an empty queue", () => {
    expect(toNativeCapturePayloads([])).toEqual([]);
  });
});

describe("drainIntentCaptures", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/core");
  });

  /* An empty queue and an absent action look the same from the inbox, and only
     one of them means the build is missing the action. */
  it("says the action answered when the queue is empty", async () => {
    vi.stubGlobal("window", {});
    vi.doMock("@capacitor/core", () => ({
      registerPlugin: () => ({ takePending: async () => ({ payloads: [] }) }),
    }));

    const { drainIntentCaptures } = await import("./capture-intent-bridge");

    expect(await drainIntentCaptures()).toEqual({ status: "ok", payloads: [] });
  });

  it("hands back what the action queued", async () => {
    vi.stubGlobal("window", {});
    vi.doMock("@capacitor/core", () => ({
      registerPlugin: () => ({
        takePending: async () => ({
          payloads: [{ message: "Sent UGX 5,000", sender: "MTN MoMo" }],
        }),
      }),
    }));

    const { drainIntentCaptures } = await import("./capture-intent-bridge");
    const drained = await drainIntentCaptures();

    expect(drained.status).toBe("ok");
    expect(drained.status === "ok" && drained.payloads[0]).toMatchObject({
      rawContent: "Sent UGX 5,000",
      sourceTitle: "MTN MoMo",
    });
  });

  it("says why when the action cannot be reached", async () => {
    vi.stubGlobal("window", {});
    vi.doMock("@capacitor/core", () => ({
      registerPlugin: () => ({
        takePending: async () => {
          throw new Error('"MoatCapture" plugin is not implemented on ios');
        },
      }),
    }));

    const { drainIntentCaptures } = await import("./capture-intent-bridge");

    expect(await drainIntentCaptures()).toEqual({
      status: "unreachable",
      detail: '"MoatCapture" plugin is not implemented on ios',
    });
  });

  it("takes nothing rather than throwing when there is no window", async () => {
    const { drainIntentCaptures } = await import("./capture-intent-bridge");

    expect((await drainIntentCaptures()).status).toBe("unreachable");
  });
});
