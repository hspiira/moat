import { afterEach, describe, expect, it, vi } from "vitest";

import { readClipboardText } from "@/lib/capture/clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubClipboard(clipboard: unknown) {
  vi.stubGlobal("navigator", clipboard === undefined ? {} : { clipboard });
}

describe("readClipboardText", () => {
  it("reports unsupported when the browser has no clipboard", () => {
    stubClipboard(undefined);

    return expect(readClipboardText()).resolves.toEqual({ status: "unsupported" });
  });

  it("reports unsupported when readText is missing", () => {
    stubClipboard({ writeText: async () => undefined });

    return expect(readClipboardText()).resolves.toEqual({ status: "unsupported" });
  });

  it("returns the copied message", () => {
    stubClipboard({ readText: async () => "Paid USh 45,000 to Grocery store" });

    return expect(readClipboardText()).resolves.toEqual({
      status: "read",
      text: "Paid USh 45,000 to Grocery store",
    });
  });

  it("treats whitespace as empty, so a blank paste is not parsed", () => {
    stubClipboard({ readText: async () => "   \n  " });

    return expect(readClipboardText()).resolves.toEqual({ status: "empty" });
  });

  it("reports empty for an empty clipboard", () => {
    stubClipboard({ readText: async () => "" });

    return expect(readClipboardText()).resolves.toEqual({ status: "empty" });
  });

  it("treats a refused paste prompt as denied", () => {
    // Declining the iOS paste confirmation rejects the promise.
    stubClipboard({
      readText: async () => {
        throw new Error("NotAllowedError");
      },
    });

    return expect(readClipboardText()).resolves.toEqual({ status: "denied" });
  });
});
