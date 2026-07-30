import type { EncryptedPayload } from "@/lib/security/pin-crypto";
import type { FullExport } from "@/lib/security/data-export";

/**
 * Moat writes two kinds of file, and until now the restore flow assumed every
 * file was the encrypted one. A plaintext export is still valid JSON, so
 * `JSON.parse` succeeded and the failure only surfaced later as a decryption
 * error — reported to the user as a wrong PIN. Detecting the shape up front is
 * what lets restore ask for a PIN only when there is something to decrypt, and
 * report the real problem otherwise.
 */
export type BackupFormat =
  | { kind: "encrypted"; payload: EncryptedPayload }
  | { kind: "plain"; payload: FullExport }
  | { kind: "unrecognised"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function detectBackupFormat(text: string): BackupFormat {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      kind: "unrecognised",
      reason: "That file isn't a Moat backup — it couldn't be read as JSON.",
    };
  }

  if (!isRecord(parsed)) {
    return {
      kind: "unrecognised",
      reason: "That file isn't a Moat backup.",
    };
  }

  // An encrypted payload is exactly salt + iv + ciphertext, all base64 strings.
  if (
    typeof parsed.salt === "string" &&
    typeof parsed.iv === "string" &&
    typeof parsed.ciphertext === "string"
  ) {
    return { kind: "encrypted", payload: parsed as unknown as EncryptedPayload };
  }

  // A plaintext export always carries a schemaVersion and the account/transaction
  // arrays. Checking two independent markers avoids matching some unrelated JSON
  // that happens to have one of them.
  if (
    typeof parsed.schemaVersion === "number" &&
    Array.isArray(parsed.accounts) &&
    Array.isArray(parsed.transactions)
  ) {
    return { kind: "plain", payload: parsed as unknown as FullExport };
  }

  return {
    kind: "unrecognised",
    reason: "That file is JSON, but not a Moat backup or export.",
  };
}
