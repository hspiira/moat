import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@/lib/security/data-export", () => ({
  collectFullExport: vi.fn(async () => ({
    exportedAt: "2026-04-07T00:00:00.000Z",
    schemaVersion: 2,
    userProfile: { id: "user:default" },
    accounts: [],
    transactions: [],
    categories: [],
    goals: [],
    budgets: [],
    investmentProfiles: [],
    imports: [],
    syncProfiles: [],
    syncOutbox: [],
  })),
  restoreFullExport: vi.fn(async () => undefined),
}));

vi.mock("@/lib/security/pin-crypto", () => ({
  encryptWithPin: vi.fn(async (value, pin) => ({
    salt: `salt:${pin}`,
    iv: "iv",
    ciphertext: `ciphertext:${JSON.stringify(value).length}`,
  })),
  decryptWithPin: vi.fn(async (payload, pin) => ({
    restored: true,
    pin,
    payload,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("encrypted backup helpers", () => {
  it("creates an encrypted backup blob with the expected filename pattern", async () => {
    const { createEncryptedBackupBlob } = await import("@/lib/security/encrypted-backup");

    const { blob, filename } = await createEncryptedBackupBlob({
      pin: "1234",
      exportedAt: new Date("2026-04-07T10:15:30.000Z"),
    });

    expect(filename).toBe("moat-backup-2026-04-07T10-15-30.000Z.enc");
    expect(await blob.text()).toContain("\"salt\":\"salt:1234\"");
    expect(await blob.text()).not.toContain("\"accounts\":[]");
  });

  it("restores backups through the shared decrypt and restore path", async () => {
    const { restoreEncryptedBackupPayload } = await import("@/lib/security/encrypted-backup");
    const { restoreFullExport } = await import("@/lib/security/data-export");

    await restoreEncryptedBackupPayload({
      payloadText: JSON.stringify({
        salt: "salt",
        iv: "iv",
        ciphertext: "ciphertext",
      }),
      pin: "1234",
    });

    expect(restoreFullExport).toHaveBeenCalledWith(
      expect.objectContaining({
        restored: true,
        pin: "1234",
      }),
    );
  });
});
