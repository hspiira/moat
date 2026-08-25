import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, getPool } from "./pool.js";
import { dropSyncTablesSql } from "./schema-reset.js";
import {
  hashSyncToken,
  mintSyncCredential,
  resolveSyncCredential,
  revokeSyncCredentials,
} from "./credentials.js";
import { SCHEMA_SQL } from "./schema.js";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = hasDatabase ? describe : describe.skip;

describeDb("sync credentials", () => {
  beforeEach(async () => {
    await getPool().query(dropSyncTablesSql());
    await getPool().query(SCHEMA_SQL);
  });

  afterAll(async () => {
    await closePool();
  });

  it("resolves a minted token to its user", async () => {
    const token = await mintSyncCredential("user:ada", "phone");

    expect(await resolveSyncCredential(token)).toBe("user:ada");
  });

  it("gives every user a different token", async () => {
    const ada = await mintSyncCredential("user:ada");
    const grace = await mintSyncCredential("user:grace");

    expect(ada).not.toBe(grace);
    expect(await resolveSyncCredential(ada)).toBe("user:ada");
    expect(await resolveSyncCredential(grace)).toBe("user:grace");
  });

  it("gives one user more than one token, so a second device does not need the first", async () => {
    const phone = await mintSyncCredential("user:ada", "phone");
    const laptop = await mintSyncCredential("user:ada", "laptop");

    expect(await resolveSyncCredential(phone)).toBe("user:ada");
    expect(await resolveSyncCredential(laptop)).toBe("user:ada");
  });

  it("does not store the token itself", async () => {
    const token = await mintSyncCredential("user:ada");
    const rows = await getPool().query<{ token_sha256: string }>(
      "select token_sha256 from sync_credentials",
    );

    expect(rows.rows[0].token_sha256).not.toBe(token);
    expect(rows.rows[0].token_sha256).toBe(hashSyncToken(token));
  });

  it("resolves nothing for a token that was never minted", async () => {
    expect(await resolveSyncCredential("made-up")).toBeNull();
  });

  it("stops resolving a revoked token", async () => {
    const token = await mintSyncCredential("user:ada");

    expect(await revokeSyncCredentials("user:ada")).toBe(1);
    expect(await resolveSyncCredential(token)).toBeNull();
  });

  it("records when a token was last used", async () => {
    const token = await mintSyncCredential("user:ada");
    await resolveSyncCredential(token);

    const rows = await getPool().query<{ last_used_at: string | null }>(
      "select last_used_at from sync_credentials",
    );
    expect(rows.rows[0].last_used_at).not.toBeNull();
  });

  it("stops resolving a token once its user is deleted", async () => {
    const token = await mintSyncCredential("user:ada");

    await getPool().query("delete from sync_users where user_id = $1", ["user:ada"]);

    expect(await resolveSyncCredential(token)).toBeNull();
  });

  it("brings the user row with a token minted for a ledger that has never synced", async () => {
    await mintSyncCredential("user:unsynced");

    const users = await getPool().query("select user_id from sync_users where user_id = $1", [
      "user:unsynced",
    ]);

    expect(users.rows).toHaveLength(1);
  });

  /* The table shipped without the key, so the deployments that matter are the
     ones already holding rows. Dropping their tokens to add the constraint
     would sign every device out. */
  it("keeps the tokens on a credentials table that predates the key", async () => {
    await getPool().query("drop table if exists sync_credentials cascade");
    await getPool().query(`
      create table sync_credentials (
        token_sha256 text primary key,
        user_id      text not null,
        label        text,
        created_at   text not null,
        last_used_at text
      );
    `);
    await getPool().query(
      `insert into sync_credentials (token_sha256, user_id, label, created_at)
       values ($1, 'user:legacy', 'hand-minted', '2026-01-01T00:00:00.000Z')`,
      [hashSyncToken("legacy-token")],
    );

    await getPool().query(SCHEMA_SQL);

    expect(await resolveSyncCredential("legacy-token")).toBe("user:legacy");

    const constraint = await getPool().query(
      "select 1 from pg_constraint where conname = 'sync_credentials_user_fk'",
    );
    expect(constraint.rowCount).toBe(1);

    await getPool().query("delete from sync_users where user_id = $1", ["user:legacy"]);
    expect(await resolveSyncCredential("legacy-token")).toBeNull();
  });
});
