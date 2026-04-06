import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native capture bridge", () => {
  it("reads and clears the pending native capture route hint through the host bridge", async () => {
    const clearPendingCaptureRouteHint = vi.fn();
    vi.stubGlobal("window", {
      moatHostBridge: {
        getPendingCaptureRouteHint: () => "/transactions/review/capture",
        clearPendingCaptureRouteHint,
      },
    });

    const {
      clearPendingNativeCaptureRouteHint,
      getPendingNativeCaptureRouteHint,
    } = await import("@/lib/native/capture-bridge");

    expect(getPendingNativeCaptureRouteHint()).toBe("/transactions/review/capture");

    clearPendingNativeCaptureRouteHint();
    expect(clearPendingCaptureRouteHint).toHaveBeenCalledTimes(1);
  });
});
