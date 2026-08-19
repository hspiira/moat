import { describe, expect, it } from "vitest";

import {
  counterpartiesById,
  partyByTransferGroup,
  partyNameFor,
} from "@/lib/domain/party-name";
import type { Counterparty, Transaction } from "@/lib/types";

const grace: Counterparty = {
  id: "counterparty:grace",
  userId: "user:default",
  name: "Auntie Grace",
  kind: "lender",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const byId = counterpartiesById([grace]);

function row(overrides: Partial<Transaction>) {
  return overrides as Transaction;
}

describe("partyNameFor", () => {
  it("shows the person's current name rather than the text stored on the row", () => {
    expect(
      partyNameFor(row({ counterpartyId: grace.id, payee: "auntie grace " }), byId),
    ).toBe("Auntie Grace");
  });

  it("falls back to the stored payee when the row names nobody", () => {
    expect(partyNameFor(row({ payee: "Boda to town" }), byId)).toBe("Boda to town");
  });

  it("falls back to the parser's raw text when there is no payee", () => {
    expect(partyNameFor(row({ rawPayee: "MTN*4471*SENT" }), byId)).toBe("MTN*4471*SENT");
  });

  it("falls back to the stored payee when the person has been deleted", () => {
    expect(
      partyNameFor(row({ counterpartyId: "counterparty:gone", payee: "Musa" }), byId),
    ).toBe("Musa");
  });

  it("has nothing to show for a row with no identity at all", () => {
    expect(partyNameFor(row({}), byId)).toBeUndefined();
  });
});

describe("partyByTransferGroup", () => {
  it("lets the leg that names nobody borrow the person from its partner", () => {
    const stamped = row({
      transferGroupId: "group:1",
      counterpartyId: grace.id,
      payee: "GRACE MOB 0700",
    });
    const partner = row({ transferGroupId: "group:1", payee: "GRACE MOB 0700" });
    const byGroup = partyByTransferGroup([stamped, partner]);

    expect(partyNameFor(partner, byId, byGroup)).toBe("Auntie Grace");
  });

  it("leaves a group that names nobody alone", () => {
    const legs = [
      row({ transferGroupId: "group:2", payee: "Own Transfer" }),
      row({ transferGroupId: "group:2", payee: "Own Transfer" }),
    ];

    expect(partyNameFor(legs[0], byId, partyByTransferGroup(legs))).toBe("Own Transfer");
  });
});
