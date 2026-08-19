import { createHash, randomBytes } from "node:crypto";

import { getPool } from "./pool.js";

export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateSyncToken(): string {
  return randomBytes(32).toString("hex");
}

export async function mintSyncCredential(userId: string, label?: string): Promise<string> {
  const token = generateSyncToken();

  await getPool().query(
    `insert into sync_credentials (token_sha256, user_id, label, created_at)
     values ($1, $2, $3, $4)`,
    [hashSyncToken(token), userId, label ?? null, new Date().toISOString()],
  );

  return token;
}

export async function revokeSyncCredentials(userId: string): Promise<number> {
  const result = await getPool().query("delete from sync_credentials where user_id = $1", [userId]);
  return result.rowCount ?? 0;
}

export async function resolveSyncCredential(token: string): Promise<string | null> {
  const result = await getPool().query<{ user_id: string }>(
    `update sync_credentials
        set last_used_at = $2
      where token_sha256 = $1
      returning user_id`,
    [hashSyncToken(token), new Date().toISOString()],
  );

  return result.rows[0]?.user_id ?? null;
}
