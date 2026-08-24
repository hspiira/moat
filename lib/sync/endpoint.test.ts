import { describe, expect, it } from "vitest";

import {
  configuredSyncEndpoint,
  needsManualSyncEndpoint,
  resolveSyncEndpoint,
} from "@/lib/sync/endpoint";

const CONFIGURED = { NEXT_PUBLIC_SYNC_ENDPOINT: "https://sync.moat.app" };
const ORIGIN = "https://moat.example.com";

describe("resolveSyncEndpoint", () => {
  it("falls back to the origin the app is served from", () => {
    expect(resolveSyncEndpoint(undefined, {}, ORIGIN)).toBe(ORIGIN);
  });

  it("prefers an address the build was given, for a split deployment", () => {
    expect(resolveSyncEndpoint(undefined, CONFIGURED, ORIGIN)).toBe("https://sync.moat.app");
  });

  it("lets a stored value win over both", () => {
    expect(resolveSyncEndpoint("https://mine.example", CONFIGURED, ORIGIN)).toBe(
      "https://mine.example",
    );
  });

  it("ignores a stored value that is only whitespace", () => {
    expect(resolveSyncEndpoint("   ", CONFIGURED, ORIGIN)).toBe("https://sync.moat.app");
  });

  it("gives nothing back when there is no origin either, as on the server", () => {
    expect(resolveSyncEndpoint(undefined, {}, "")).toBe("");
    expect(configuredSyncEndpoint({})).toBe("");
  });
});

describe("needsManualSyncEndpoint", () => {
  it("is false in a browser, which is why the field is not shown", () => {
    expect(needsManualSyncEndpoint({}, ORIGIN)).toBe(false);
    expect(needsManualSyncEndpoint(CONFIGURED, ORIGIN)).toBe(false);
  });

  it("is true only when nothing can answer", () => {
    expect(needsManualSyncEndpoint({}, "")).toBe(true);
  });
});

describe("inside the app, where the origin is the device", () => {
  const CAPACITOR = "capacitor://localhost";

  it("does not mistake the app's own scheme for a sync server", () => {
    expect(resolveSyncEndpoint(undefined, {}, CAPACITOR)).toBe("");
    expect(needsManualSyncEndpoint({}, CAPACITOR)).toBe(true);
  });

  it("uses the address the build was given instead", () => {
    expect(resolveSyncEndpoint(undefined, CONFIGURED, CAPACITOR)).toBe("https://sync.moat.app");
    expect(needsManualSyncEndpoint(CONFIGURED, CAPACITOR)).toBe(false);
  });
});
