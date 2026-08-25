import { randomUUID } from "node:crypto";

import type pg from "pg";

import { decideIdentityLink, type IdentityLinkDecision } from "../auth/identity-link.js";
import { withUserTransaction } from "./pool.js";

export type ResolvedIdentity =
  | { status: "ok"; userId: string; isNewUser: boolean }
  | { status: "already_linked_elsewhere" }
  | { status: "proposed_id_taken" };

async function readState(
  client: pg.PoolClient,
  params: {
    issuer: string;
    subject: string;
    proposedUserId: string | null;
    proposedIsProven: boolean;
  },
) {
  const linked = await client.query<{ user_id: string }>(
    "select user_id from sync_identities where issuer = $1 and subject = $2",
    [params.issuer, params.subject],
  );

  let proposedIsClaimed = false;
  if (params.proposedUserId) {
    // Claimed by another provider account, or already holding records. Either
    // means it is not this device's to offer.
    const claimed = await client.query<{ claimed: boolean }>(
      `select exists (select 1 from sync_identities where user_id = $1)
           or exists (select 1 from sync_records where user_id = $1) as claimed`,
      [params.proposedUserId],
    );
    proposedIsClaimed = claimed.rows[0]?.claimed === true;
  }

  return {
    linkedUserId: linked.rows[0]?.user_id ?? null,
    proposedIsClaimed,
    proposedIsProven: params.proposedIsProven,
  };
}

export async function resolveIdentity(params: {
  issuer: string;
  subject: string;
  email?: string;
  proposedUserId?: string | null;
  proposedIsProven?: boolean;
}): Promise<ResolvedIdentity> {
  const proposedUserId = params.proposedUserId?.trim() || null;

  // Scoped to the offered ledger, because the records that prove its id is
  // taken sit behind a policy. Read these on the pool instead and the check
  // reports every id as free, which hands the ledger to whoever names it.
  return withUserTransaction(proposedUserId ?? "", async (client) => {
    // One provider account settles on one ledger. Held for the transaction so
    // the inserts below cannot race a second sign-in into a second ledger.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `${params.issuer}\n${params.subject}`,
    ]);

    const state = await readState(client, {
      issuer: params.issuer,
      subject: params.subject,
      proposedUserId,
      proposedIsProven: params.proposedIsProven === true,
    });
    const decision: IdentityLinkDecision = decideIdentityLink({ proposedUserId, state });

    if (decision.outcome === "already_linked_elsewhere") {
      return { status: "already_linked_elsewhere" };
    }
    if (decision.outcome === "proposed_id_taken") {
      return { status: "proposed_id_taken" };
    }
    if (decision.outcome === "sign_in") {
      return { status: "ok", userId: decision.userId, isNewUser: false };
    }

    const userId = decision.outcome === "link" ? decision.userId : `user:${randomUUID()}`;
    const now = new Date().toISOString();

    await client.query(
      "insert into sync_users (user_id, created_at) values ($1, $2) on conflict (user_id) do nothing",
      [userId, now],
    );
    await client.query(
      `insert into sync_identities (issuer, subject, user_id, email, created_at)
       values ($1, $2, $3, $4, $5)
       on conflict (issuer, subject) do nothing`,
      [params.issuer, params.subject, userId, params.email ?? null, now],
    );

    return {
      status: "ok",
      userId,
      isNewUser: decision.outcome === "sign_up",
    };
  });
}
