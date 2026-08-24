import { describe, expect, it } from "vitest";

import {
  configuredSyncEndpoint,
  needsManualSyncEndpoint,
  resolveSyncEndpoint,
} from "@/lib/sync/endpoint";

const CONFIGURED = { NEXT_PUBLIC_SYNC_ENDPOINT: "https://sync.moat.app" };

describe("resolveSyncEndpoint", () => {
  it("uses what the build was given, so nobody has to type it", () => {
    expect(resolveSyncEndpoint(undefined, CONFIGURED)).toBe("https://sync.moat.app");
  });

  it("lets a stored value win, for anyone running their own", () => {
    expect(resolveSyncEndpoint("https://mine.example", CONFIGURED)).toBe("https://mine.example");
  });

  it("ignores a stored value that is only whitespace", () => {
    expect(resolveSyncEndpoint("   ", CONFIGURED)).toBe("https://sync.moat.app");
  });

  it("gives nothing back when neither side has an answer", () => {
    expect(resolveSyncEndpoint(undefined, {})).toBe("");
    expect(configuredSyncEndpoint({})).toBe("");
  });
});

describe("needsManualSyncEndpoint", () => {
  it("is false once the build carries one, which is when the field disappears", () => {
    expect(needsManualSyncEndpoint(CONFIGURED)).toBe(false);
  });

  it("is true for a build that was never told, so the field is still offered", () => {
    expect(needsManualSyncEndpoint({})).toBe(true);
    expect(needsManualSyncEndpoint({ NEXT_PUBLIC_SYNC_ENDPOINT: "  " })).toBe(true);
  });
});
