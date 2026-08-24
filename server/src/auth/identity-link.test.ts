import { describe, expect, it } from "vitest";

import { decideIdentityLink } from "./identity-link.js";

const unlinked = { linkedUserId: null, proposedIsClaimed: false };

describe("decideIdentityLink", () => {
  it("signs up when nothing exists on either side", () => {
    expect(decideIdentityLink({ state: unlinked })).toEqual({ outcome: "sign_up" });
  });

  it("links the ledger already on the device when its id is unclaimed", () => {
    expect(decideIdentityLink({ proposedUserId: "user:mine", state: unlinked })).toEqual({
      outcome: "link",
      userId: "user:mine",
    });
  });

  /* Without this an unguessable id would be the only thing between two
     people's records, and a guess would be enough to take a ledger. */
  it("refuses an id that is already spoken for", () => {
    expect(
      decideIdentityLink({
        proposedUserId: "user:someone-else",
        state: { linkedUserId: null, proposedIsClaimed: true },
      }),
    ).toEqual({ outcome: "proposed_id_taken" });
  });

  it("signs in when this account already has a ledger and the device offers none", () => {
    expect(
      decideIdentityLink({ state: { linkedUserId: "user:mine", proposedIsClaimed: false } }),
    ).toEqual({ outcome: "sign_in", userId: "user:mine" });
  });

  it("signs in when the device offers the very ledger this account syncs", () => {
    expect(
      decideIdentityLink({
        proposedUserId: "user:mine",
        state: { linkedUserId: "user:mine", proposedIsClaimed: false },
      }),
    ).toEqual({ outcome: "sign_in", userId: "user:mine" });
  });

  /* Two ledgers, one person. Merging would mean guessing which near-identical
     transactions are the same event, which either doubles spending or hides it. */
  it("refuses to attach this account to a second ledger", () => {
    expect(
      decideIdentityLink({
        proposedUserId: "user:other",
        state: { linkedUserId: "user:mine", proposedIsClaimed: false },
      }),
    ).toEqual({ outcome: "already_linked_elsewhere" });
  });

  it("treats a blank proposal as no proposal", () => {
    expect(decideIdentityLink({ proposedUserId: "   ", state: unlinked })).toEqual({
      outcome: "sign_up",
    });
  });

  it("does not let a claimed id through just because it was padded", () => {
    expect(
      decideIdentityLink({
        proposedUserId: "  user:someone-else  ",
        state: { linkedUserId: null, proposedIsClaimed: true },
      }),
    ).toEqual({ outcome: "proposed_id_taken" });
  });
});
