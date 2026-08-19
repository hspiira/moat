import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, getPool } from "./pool.js";
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
    await getPool().query("drop table if exists sync_credentials");
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
});
