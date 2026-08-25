import { createHash, randomBytes } from "node:crypto";

import { getPool, withTransaction } from "./pool.js";

export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateSyncToken(): string {
  return randomBytes(32).toString("hex");
}

export async function mintSyncCredential(userId: string, label?: string): Promise<string> {
  const token = generateSyncToken();

  // The credential references the user now, so a token minted by hand for a
  // ledger that has never synced has to bring that row with it.
  await withTransaction(async (client) => {
    await client.query(
      `insert into sync_users (user_id, created_at)
       values ($1, moat_now_iso())
       on conflict (user_id) do nothing`,
      [userId],
    );
    await client.query(
      `insert into sync_credentials (token_sha256, user_id, label, created_at)
       values ($1, $2, $3, moat_now_iso())`,
      [hashSyncToken(token), userId, label ?? null],
    );
  });

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
