import { randomUUID } from "node:crypto";

import { decideIdentityLink, type IdentityLinkDecision } from "../auth/identity-link.js";
import { getPool } from "./pool.js";

export type ResolvedIdentity =
  | { status: "ok"; userId: string; isNewUser: boolean }
  | { status: "already_linked_elsewhere" }
  | { status: "proposed_id_taken" };

async function readState(params: {
  issuer: string;
  subject: string;
  proposedUserId: string | null;
  proposedIsProven: boolean;
}) {
  const linked = await getPool().query<{ user_id: string }>(
    "select user_id from sync_identities where issuer = $1 and subject = $2",
    [params.issuer, params.subject],
  );

  let proposedIsClaimed = false;
  if (params.proposedUserId) {
    // Claimed by another provider account, or already holding records. Either
    // means it is not this device's to offer.
    const claimed = await getPool().query<{ claimed: boolean }>(
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
  // True when the caller presented a working token for the id it offered.
  proposedIsProven?: boolean;
}): Promise<ResolvedIdentity> {
  const proposedUserId = params.proposedUserId?.trim() || null;
  const state = await readState({
    ...params,
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

  await getPool().query(
    "insert into sync_users (user_id, created_at) values ($1, $2) on conflict (user_id) do nothing",
    [userId, now],
  );
  // A race between two devices signing in with the same provider account must
  // settle on one row rather than two ledgers.
  await getPool().query(
    `insert into sync_identities (issuer, subject, user_id, email, created_at)
     values ($1, $2, $3, $4, $5)
     on conflict (issuer, subject) do nothing`,
    [params.issuer, params.subject, userId, params.email ?? null, now],
  );

  const settled = await getPool().query<{ user_id: string }>(
    "select user_id from sync_identities where issuer = $1 and subject = $2",
    [params.issuer, params.subject],
  );
  const winner = settled.rows[0]?.user_id ?? userId;

  return {
    status: "ok",
    userId: winner,
    isNewUser: decision.outcome === "sign_up" && winner === userId,
  };
}
