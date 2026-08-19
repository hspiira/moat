import { describe, expect, it, vi } from "vitest";

import { pruneSealedBackups } from "@/lib/integrations/auto-backup";
import type { GoogleDriveBackupFile } from "@/lib/integrations/google-drive-backup";

function file(name: string, modifiedTime: string): GoogleDriveBackupFile {
  return { fileId: name, name, modifiedTime };
}

describe("pruning automatic backups", () => {
  it("keeps the newest and removes the rest", async () => {
    const deleteFile = vi.fn(async () => undefined);
    const listBackups = async () => [
      file("moat-sealed-2026-08-19T09-00-00.000Z.enc", "2026-08-19T09:00:00.000Z"),
      file("moat-sealed-2026-08-18T09-00-00.000Z.enc", "2026-08-18T09:00:00.000Z"),
      file("moat-sealed-2026-08-17T09-00-00.000Z.enc", "2026-08-17T09:00:00.000Z"),
    ];

    await expect(pruneSealedBackups({ listBackups, deleteFile }, 2)).resolves.toBe(1);
    expect(deleteFile).toHaveBeenCalledExactlyOnceWith(
      "moat-sealed-2026-08-17T09-00-00.000Z.enc",
    );
  });

  it("never touches a backup the user made with a PIN", async () => {
    const deleteFile = vi.fn(async () => undefined);
    const listBackups = async () => [
      file("moat-backup-2026-08-19T09-00-00.000Z.enc", "2026-08-19T09:00:00.000Z"),
      file("moat-backup-2026-01-01T09-00-00.000Z.enc", "2026-01-01T09:00:00.000Z"),
    ];

    await expect(pruneSealedBackups({ listBackups, deleteFile }, 1)).resolves.toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("does nothing while there are fewer than the keep count", async () => {
    const deleteFile = vi.fn(async () => undefined);
    const listBackups = async () => [
      file("moat-sealed-2026-08-19T09-00-00.000Z.enc", "2026-08-19T09:00:00.000Z"),
    ];

    await expect(pruneSealedBackups({ listBackups, deleteFile }, 14)).resolves.toBe(0);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
