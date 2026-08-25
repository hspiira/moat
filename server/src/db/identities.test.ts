import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { closePool, getPool } from "./pool.js";
import { resolveIdentity } from "./identities.js";
import { dropSyncTablesSql } from "./schema-reset.js";
import { SCHEMA_SQL } from "./schema.js";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = hasDatabase ? describe : describe.skip;

const RESTRICTED_ROLE = "moat_identity_rls_test";

async function createRestrictedRole() {
  await getPool().query(`
    drop role if exists ${RESTRICTED_ROLE};
    create role ${RESTRICTED_ROLE} login;
    grant usage on schema public to ${RESTRICTED_ROLE};
    grant select, insert, update, delete on all tables in schema public to ${RESTRICTED_ROLE};
  `);
}

async function dropRestrictedRole() {
  await getPool().query(`
    revoke all on all tables in schema public from ${RESTRICTED_ROLE};
    revoke usage on schema public from ${RESTRICTED_ROLE};
    drop role if exists ${RESTRICTED_ROLE};
  `);
}

/* The suite runs as a superuser and superusers bypass RLS, so a check that
   reads an RLS table would look correct here no matter how it is written. The
   deployment connects as a role the policies apply to, so the interesting
   assertions have to as well. */
async function asRestrictedRole<T>(run: () => Promise<T>): Promise<T> {
  const original = process.env.DATABASE_URL as string;
  const url = new URL(original);
  url.username = RESTRICTED_ROLE;
  url.password = "";

  await closePool();
  process.env.DATABASE_URL = url.toString();

  try {
    return await run();
  } finally {
    await closePool();
    process.env.DATABASE_URL = original;
  }
}

async function seedLedgerWithoutIdentity(userId: string) {
  await getPool().query("insert into sync_users (user_id, created_at) values ($1, $2)", [
    userId,
    "2026-01-01T00:00:00.000Z",
  ]);
  await getPool().query(
    `insert into sync_records (user_id, entity_type, entity_id, payload, deleted, updated_at, server_version_token)
     values ($1, 'categories', 'category:1', '{}', false, '2026-01-01T00:00:00.000Z', 'sv:1')`,
    [userId],
  );
}

describeDb("resolveIdentity", () => {
  beforeEach(async () => {
    await getPool().query(dropSyncTablesSql());
    await getPool().query(SCHEMA_SQL);
    await createRestrictedRole();
  });

  afterEach(dropRestrictedRole);

  afterAll(closePool);

  /* The ledger this covers has records but no provider account, which is the
     device syncing on a hand-minted token. Its records are the only evidence
     the id is taken, and they sit behind a policy, so reading them outside a
     scoped transaction reports the id as free and hands the ledger over. */
  it("refuses an offered id that already holds records, as the role the policies apply to", async () => {
    await seedLedgerWithoutIdentity("user:victim");

    const resolved = await asRestrictedRole(() =>
      resolveIdentity({
        issuer: "https://accounts.google.com",
        subject: "attacker-subject",
        proposedUserId: "user:victim",
        proposedIsProven: false,
      }),
    );

    expect(resolved).toEqual({ status: "proposed_id_taken" });
  });

  it("leaves the offered ledger unlinked when it refuses", async () => {
    await seedLedgerWithoutIdentity("user:victim");

    await asRestrictedRole(() =>
      resolveIdentity({
        issuer: "https://accounts.google.com",
        subject: "attacker-subject",
        proposedUserId: "user:victim",
        proposedIsProven: false,
      }),
    );

    const identities = await getPool().query("select user_id from sync_identities");

    expect(identities.rows).toHaveLength(0);
  });

  it("still accepts an offered id the caller proved it holds a token for", async () => {
    await seedLedgerWithoutIdentity("user:mine");

    const resolved = await asRestrictedRole(() =>
      resolveIdentity({
        issuer: "https://accounts.google.com",
        subject: "owner-subject",
        proposedUserId: "user:mine",
        proposedIsProven: true,
      }),
    );

    expect(resolved).toEqual({ status: "ok", userId: "user:mine", isNewUser: false });
  });

  it("signs up a fresh ledger when the caller offers no id", async () => {
    const resolved = await asRestrictedRole(() =>
      resolveIdentity({ issuer: "https://accounts.google.com", subject: "new-subject" }),
    );

    expect(resolved).toMatchObject({ status: "ok", isNewUser: true });
  });

  it("signs the same provider account back in to the ledger it already has", async () => {
    const first = await asRestrictedRole(() =>
      resolveIdentity({ issuer: "https://accounts.google.com", subject: "returning" }),
    );
    const second = await asRestrictedRole(() =>
      resolveIdentity({ issuer: "https://accounts.google.com", subject: "returning" }),
    );

    expect(first.status).toBe("ok");
    expect(second).toEqual({
      status: "ok",
      userId: (first as { userId: string }).userId,
      isNewUser: false,
    });
  });

  it("refuses to attach a provider account that already syncs another ledger", async () => {
    const first = await asRestrictedRole(() =>
      resolveIdentity({ issuer: "https://accounts.google.com", subject: "taken" }),
    );

    const second = await asRestrictedRole(() =>
      resolveIdentity({
        issuer: "https://accounts.google.com",
        subject: "taken",
        proposedUserId: `${(first as { userId: string }).userId}:different`,
      }),
    );

    expect(second).toEqual({ status: "already_linked_elsewhere" });
  });
});
