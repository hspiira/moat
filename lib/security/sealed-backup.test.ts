import { describe, expect, it } from "vitest";

import { generateDek } from "@/lib/security/key-hierarchy";
import type { FullExport } from "@/lib/security/data-export";
import {
  SealedBackupError,
  buildSealedBackupFilename,
  isSealedBackupFilename,
  openSealedBackup,
  sealBackup,
} from "@/lib/security/sealed-backup";

function exportFixture(): FullExport {
  return {
    exportedAt: "2026-08-19T09:00:00.000Z",
    schemaVersion: 3,
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
  };
}

describe("sealed backup", () => {
  it("comes back out as it went in", async () => {
    const dek = await generateDek();
    const payload = await sealBackup({ data: exportFixture(), dek });

    expect(payload.ciphertext).not.toContain("schemaVersion");
    await expect(openSealedBackup({ payload, dek })).resolves.toEqual(exportFixture());
  });

  it("refuses a key that did not seal it", async () => {
    const payload = await sealBackup({ data: exportFixture(), dek: await generateDek() });

    await expect(
      openSealedBackup({ payload, dek: await generateDek() }),
    ).rejects.toBeInstanceOf(SealedBackupError);
  });

  it("says so rather than guessing at a format it does not know", async () => {
    const dek = await generateDek();
    const payload = await sealBackup({ data: exportFixture(), dek });

    await expect(
      openSealedBackup({ payload: { ...payload, version: 99 }, dek }),
    ).rejects.toThrow("format 99");
  });

  it("names files so the restore screen knows what a device needs to open them", () => {
    const name = buildSealedBackupFilename(new Date("2026-08-19T09:00:00.000Z"));

    expect(name).toBe("moat-sealed-2026-08-19T09-00-00.000Z.enc");
    expect(isSealedBackupFilename(name)).toBe(true);
    expect(isSealedBackupFilename("moat-backup-2026-08-19T09-00-00.000Z.enc")).toBe(false);
  });
});
