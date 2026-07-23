import { describe, expect, it } from "vitest";

import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";

describe("codec", () => {
  it("round-trips bytes through base64", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(64));

    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("round-trips a large buffer without throwing (spread-argument variant overflows the call stack)", () => {
    // crypto.getRandomValues caps out at 65,536 bytes per call, so fill a
    // larger buffer with a deterministic pattern instead.
    const bytes = new Uint8Array(300_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 256;
    }

    const encoded = bytesToBase64(bytes);
    expect(base64ToBytes(encoded)).toEqual(bytes);
  });
});
