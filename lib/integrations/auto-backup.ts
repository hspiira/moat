import type { GoogleDriveBackupClient } from "@/lib/integrations/google-drive-backup";
import { createSealedBackupBlob, isSealedBackupFilename } from "@/lib/security/sealed-backup";

// Daily uploads accumulate against the user's own Drive quota, so old ones are
// removed. Only the automatic sealed files are ever touched; a backup the user
// made by hand with a PIN is theirs to keep.
export const SEALED_BACKUPS_TO_KEEP = 14;

export async function pruneSealedBackups(
  client: Pick<GoogleDriveBackupClient, "listBackups" | "deleteFile">,
  keep: number = SEALED_BACKUPS_TO_KEEP,
): Promise<number> {
  const sealed = (await client.listBackups()).filter((file) =>
    isSealedBackupFilename(file.name),
  );

  const excess = sealed.slice(keep);
  for (const file of excess) {
    await client.deleteFile(file.fileId);
  }

  return excess.length;
}

export async function runDailyDriveBackup(params: {
  client: Pick<GoogleDriveBackupClient, "uploadBackup" | "listBackups" | "deleteFile">;
  dek: CryptoKey;
  now?: Date;
  keep?: number;
}): Promise<{ filename: string; pruned: number }> {
  const { blob, filename } = await createSealedBackupBlob({
    dek: params.dek,
    exportedAt: params.now,
  });

  await params.client.uploadBackup({ filename, blob });
  const pruned = await pruneSealedBackups(params.client, params.keep);

  return { filename, pruned };
}
