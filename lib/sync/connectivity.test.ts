import { describe, expect, it } from "vitest";

import { isKnownOffline } from "@/lib/sync/connectivity";

describe("isKnownOffline", () => {
  it("believes the browser when it says it is offline", () => {
    expect(isKnownOffline(false, false)).toBe(true);
  });

  it("believes the browser when it says it is online", () => {
    expect(isKnownOffline(false, true)).toBe(false);
  });

  it("never blocks the app on that answer, which is false there regardless", () => {
    expect(isKnownOffline(true, false)).toBe(false);
    expect(isKnownOffline(true, true)).toBe(false);
  });

  it("does not claim to know on the server, where there is no navigator", () => {
    expect(isKnownOffline(false, undefined)).toBe(false);
  });
});
