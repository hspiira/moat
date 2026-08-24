import type { BackupFormat } from "@/lib/security/backup-format";

export type BackupRestorePlan =
  | { action: "refuse"; reason: string }
  | { action: "plain" }
  | { action: "sealed" }
  | { action: "encrypted" };

export const LOCKED_FOR_SEALED_RESTORE =
  "Unlock Moat first, a sealed backup opens with this device's key, not a PIN.";

export const PIN_NEEDED_FOR_ENCRYPTED_RESTORE =
  "This backup is encrypted. Enter the PIN used to create it.";

export const MIN_RESTORE_PIN_LENGTH = 4;

export function planBackupRestore(
  format: BackupFormat,
  context: { hasDeviceKey: boolean; pinLength: number },
): BackupRestorePlan {
  if (format.kind === "unrecognised") {
    return { action: "refuse", reason: format.reason };
  }

  if (format.kind === "plain") {
    return { action: "plain" };
  }

  if (format.kind === "sealed") {
    return context.hasDeviceKey
      ? { action: "sealed" }
      : { action: "refuse", reason: LOCKED_FOR_SEALED_RESTORE };
  }

  return context.pinLength >= MIN_RESTORE_PIN_LENGTH
    ? { action: "encrypted" }
    : { action: "refuse", reason: PIN_NEEDED_FOR_ENCRYPTED_RESTORE };
}
