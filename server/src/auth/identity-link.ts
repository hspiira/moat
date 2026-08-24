export type IdentityLinkState = {
  // The user this provider account is already linked to, if any.
  linkedUserId: string | null;
  // Whether the id the device offered is already spoken for, by an identity or
  // by records. Only meaningful when a proposal was made.
  proposedIsClaimed: boolean;
  // Whether the caller proved it already holds a token for the id it offered.
  // Someone syncing on a hand-minted token has records, so the unclaimed check
  // alone would shut them out of ever adding a provider account.
  proposedIsProven: boolean;
};

export type IdentityLinkDecision =
  | { outcome: "sign_in"; userId: string }
  | { outcome: "link"; userId: string }
  | { outcome: "sign_up" }
  | { outcome: "already_linked_elsewhere" }
  | { outcome: "proposed_id_taken" };

// A provider account that already syncs a ledger must never be attached to a
// second one, and an id the device offers must be unclaimed before it is
// accepted. cuid2s are unguessable, but that cannot be the only thing standing
// between two people's records.
export function decideIdentityLink(params: {
  proposedUserId?: string | null;
  state: IdentityLinkState;
}): IdentityLinkDecision {
  const proposed = params.proposedUserId?.trim() || null;
  const { linkedUserId, proposedIsClaimed } = params.state;

  if (linkedUserId) {
    if (!proposed || proposed === linkedUserId) {
      return { outcome: "sign_in", userId: linkedUserId };
    }
    return { outcome: "already_linked_elsewhere" };
  }

  if (!proposed) {
    return { outcome: "sign_up" };
  }

  if (proposedIsClaimed && !params.state.proposedIsProven) {
    return { outcome: "proposed_id_taken" };
  }

  return { outcome: "link", userId: proposed };
}
