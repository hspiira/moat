import { describe, expect, it } from "vitest";

import { parseNativeCaptureUrl } from "./capture-deep-link";

describe("parseNativeCaptureUrl", () => {
  it("accepts a Shortcut capture and decodes its message", () => {
    expect(
      parseNativeCaptureUrl(
        "moat://capture?text=Paid%20UGX%2045000%20to%20Shop&sender=MTN&occurredAt=2026-08-25T10%3A00%3A00.000Z",
      ),
    ).toEqual({
      channel: "shared_text",
      source: "shared_text",
      rawContent: "Paid UGX 45000 to Shop",
      sourceTitle: "MTN",
      occurredAt: "2026-08-25T10:00:00.000Z",
    });
  });

  it("rejects unrelated URLs and captures without text", () => {
    expect(parseNativeCaptureUrl("https://example.com?text=hello")).toBeNull();
    expect(parseNativeCaptureUrl("moat://capture")).toBeNull();
    expect(parseNativeCaptureUrl("moat://other?text=hello")).toBeNull();
  });
});

/* A Shortcut builds this URL by hand, so the timestamp is whatever the person
   wired into it. It reaches a stored, synced field, and Shortcuts makes it easy
   to pass a formatted date rather than an ISO one. */
describe("parseNativeCaptureUrl timestamps", () => {
  it("keeps a timestamp it can read", () => {
    expect(
      parseNativeCaptureUrl("moat://capture?text=Sent%20UGX%205000&occurredAt=2026-04-07T10:00:00.000Z")
        ?.occurredAt,
    ).toBe("2026-04-07T10:00:00.000Z");
  });

  it("keeps the message and drops a timestamp it cannot read", () => {
    const payload = parseNativeCaptureUrl("moat://capture?text=Sent%20UGX%205000&occurredAt=today");

    expect(payload?.rawContent).toBe("Sent UGX 5000");
    expect(payload?.occurredAt).toBeUndefined();
  });

  it("treats an empty timestamp as none given", () => {
    expect(parseNativeCaptureUrl("moat://capture?text=Sent&occurredAt=%20")?.occurredAt).toBeUndefined();
  });
});
