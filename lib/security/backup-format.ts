import type { EncryptedPayload } from "@/lib/security/pin-crypto";
import type { FullExport } from "@/lib/security/data-export";

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

  if (
    typeof parsed.salt === "string" &&
    typeof parsed.iv === "string" &&
    typeof parsed.ciphertext === "string"
  ) {
    return { kind: "encrypted", payload: parsed as unknown as EncryptedPayload };
  }

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
