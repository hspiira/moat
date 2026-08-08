import { describe, expect, it } from "vitest";

import {
  defaultCaptureAutomationSettings,
  messageSenderCatalog,
  resolveMessageSenders,
  type CaptureAutomationSettings,
} from "@/lib/native/capture-settings";

function settings(overrides: Partial<CaptureAutomationSettings> = {}): CaptureAutomationSettings {
  return { ...defaultCaptureAutomationSettings, ...overrides };
}

describe("message capture defaults", () => {
  it("starts switched off, because capture reads money messages", () => {
    expect(defaultCaptureAutomationSettings.messageCaptureEnabled).toBe(false);
  });

  it("gives every catalog sender at least one term to match on", () => {
    for (const entry of messageSenderCatalog) {
      expect(entry.matchTerms.length, `${entry.id} has no match term`).toBeGreaterThan(0);
    }
  });

  it("uses a unique id for every catalog sender", () => {
    const ids = messageSenderCatalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveMessageSenders", () => {
  it("returns only the senders the person opted into", () => {
    const resolved = resolveMessageSenders(settings({ allowedMessageSenders: ["stanbic"] }));

    expect(resolved.map((entry) => entry.id)).toEqual(["stanbic"]);
  });

  it("returns nothing when every sender is opted out", () => {
    expect(resolveMessageSenders(settings({ allowedMessageSenders: [] }))).toEqual([]);
  });

  it("includes a sender the person added themselves", () => {
    const resolved = resolveMessageSenders(
      settings({
        allowedMessageSenders: ["my-sacco"],
        customMessageSenders: [
          { id: "my-sacco", label: "My SACCO", matchTerms: ["Wazalendo"] },
        ],
      }),
    );

    expect(resolved.map((entry) => entry.label)).toEqual(["My SACCO"]);
  });

  it("ignores an opted-in id that no longer exists", () => {
    // A sender the person removed must not break the filter.
    const resolved = resolveMessageSenders(
      settings({ allowedMessageSenders: ["stanbic", "deleted-sender"] }),
    );

    expect(resolved.map((entry) => entry.id)).toEqual(["stanbic"]);
  });
});
