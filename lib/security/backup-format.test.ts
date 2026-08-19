import { describe, expect, it } from "vitest";

import { detectBackupFormat } from "@/lib/security/backup-format";

const ENCRYPTED = JSON.stringify({
  salt: "c2FsdA==",
  iv: "aXY=",
  ciphertext: "Y2lwaGVy",
});

const PLAIN_EXPORT = JSON.stringify({
  exportedAt: "2026-07-29T00:00:00.000Z",
  schemaVersion: 1,
  userProfile: null,
  accounts: [],
  transactions: [],
  categories: [],
  goals: [],
  budgets: [],
  investmentProfiles: [],
  imports: [],
  syncProfiles: [],
  syncOutbox: [],
});

describe("detectBackupFormat", () => {
  it("recognises an encrypted backup", () => {
    const result = detectBackupFormat(ENCRYPTED);
    expect(result.kind).toBe("encrypted");
  });

  it("recognises a plaintext export", () => {
    const result = detectBackupFormat(PLAIN_EXPORT);
    expect(result.kind).toBe("plain");
  });

  it("rejects a file that is not JSON at all", () => {
    const result = detectBackupFormat("not json {{{");
    expect(result.kind).toBe("unrecognised");
  });

  it("rejects unrelated JSON", () => {
    const result = detectBackupFormat(JSON.stringify({ hello: "world" }));
    expect(result.kind).toBe("unrecognised");
  });

  it("does not mistake a partial object for an export", () => {
    const result = detectBackupFormat(JSON.stringify({ schemaVersion: 1 }));
    expect(result.kind).toBe("unrecognised");
  });

  it("does not mistake a partial object for an encrypted payload", () => {
    const result = detectBackupFormat(JSON.stringify({ salt: "x", iv: "y" }));
    expect(result.kind).toBe("unrecognised");
  });
});

describe("a sealed backup", () => {
  it("is recognised by its own marker, not by looking like an encrypted one", () => {
    const format = detectBackupFormat(
      JSON.stringify({
        format: "moat-sealed-backup",
        version: 1,
        iv: "aXY=",
        ciphertext: "Y3Q=",
      }),
    );

    expect(format.kind).toBe("sealed");
  });

  it("is still told apart from a PIN-encrypted backup", () => {
    const format = detectBackupFormat(
      JSON.stringify({ salt: "c2E=", iv: "aXY=", ciphertext: "Y3Q=" }),
    );

    expect(format.kind).toBe("encrypted");
  });
});
