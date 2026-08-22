import { describe, expect, it } from "vitest";

import { isNamedPartyKey, planNamedParty, suggestedPartyName } from "@/lib/domain/name-party";
import type { Counterparty, Transaction } from "@/lib/types";

const USER = "user:default";
const STAMP = "2026-08-20T00:00:00.000Z";

function entry(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "account:momo",
    type: "expense",
    amount: 5_000,
    currency: "UGX",
    originalAmount: 5_000,
    occurredOn: "2026-08-05",
    categoryId: "category:airtime",
    reconciliationState: "posted",
    source: "sms",
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt: "2026-08-05T08:00:00.000Z",
    ...values,
  };
}

function request(overrides: Partial<Parameters<typeof planNamedParty>[0]> = {}) {
  return planNamedParty({
    partyKey: "name:mtnmobilemoney",
    name: "MTN airtime",
    nature: "business",
    transactions: [
      entry({ id: "a", payee: "MTNMOBILEMONEY" }),
      entry({ id: "b", payee: "mtnmobilemoney" }),
      entry({ id: "other", payee: "Boda Rider" }),
    ],
    existing: [],
    userId: USER,
    timestamp: STAMP,
    id: "party:new",
    ...overrides,
  });
}

describe("planNamedParty", () => {
  it("claims every row that was grouped under the name being replaced", () => {
    const plan = request();

    expect(plan?.transactions.map((row) => row.id)).toEqual(["a", "b"]);
    expect(plan?.counterparty.name).toBe("MTN airtime");
    expect(plan?.isNew).toBe(true);
  });

  it("does not owe money either way", () => {
    expect(request()?.counterparty.kind).toBe("none");
  });

  it("records what the party is", () => {
    expect(request()?.counterparty.nature).toBe("business");
  });

  it("leaves rows belonging to another party alone", () => {
    const plan = request({
      transactions: [
        entry({ id: "a", payee: "MTNMOBILEMONEY" }),
        entry({ id: "taken", payee: "MTNMOBILEMONEY", counterpartyId: "party:someone-else" }),
      ],
    });

    expect(plan?.transactions.map((row) => row.id)).toEqual(["a"]);
  });

  it("can rename a party that already has a name", () => {
    const plan = request({
      partyKey: "party:party:mtn",
      name: "MTN Uganda",
      transactions: [entry({ id: "e", payee: "MTNMOBILEMONEY", counterpartyId: "party:mtn" })],
    });

    expect(plan?.transactions.map((row) => row.id)).toEqual(["e"]);
    expect(plan?.counterparty.name).toBe("MTN Uganda");
  });

  it("folds a second spelling into the party already named", () => {
    const existing: Counterparty = {
      id: "party:mtn",
      userId: USER,
      name: "MTN airtime",
      kind: "none",
      nature: "business",
      isArchived: false,
      createdAt: STAMP,
      updatedAt: STAMP,
    };

    const plan = request({
      partyKey: "name:mtn mobile money",
      existing: [existing],
      transactions: [entry({ id: "c", payee: "MTN Mobile Money" })],
    });

    expect(plan?.isNew).toBe(false);
    expect(plan?.counterparty.id).toBe("party:mtn");
    expect(plan?.transactions.map((row) => row.id)).toEqual(["c"]);
  });

  it("keeps a debt side the party already had", () => {
    const lender: Counterparty = {
      id: "party:aunt",
      userId: USER,
      name: "Aunt Grace",
      kind: "lender",
      isArchived: false,
      createdAt: STAMP,
      updatedAt: STAMP,
    };

    const plan = request({
      name: "Aunt Grace",
      nature: "person",
      existing: [lender],
      partyKey: "name:grace",
      transactions: [entry({ id: "d", payee: "Grace" })],
    });

    expect(plan?.counterparty.kind).toBe("lender");
  });

  it("gives back nothing when there is no name to save", () => {
    expect(request({ name: "   " })).toBeNull();
  });

  it("gives back nothing when nothing would change", () => {
    const existing: Counterparty = {
      id: "party:mtn",
      userId: USER,
      name: "MTN airtime",
      kind: "none",
      nature: "business",
      isArchived: false,
      createdAt: STAMP,
      updatedAt: STAMP,
    };

    expect(request({ existing: [existing], transactions: [] })).toBeNull();
  });
});

describe("isNamedPartyKey", () => {
  it("tells a named party from one read off a row", () => {
    expect(isNamedPartyKey("party:abc")).toBe(true);
    expect(isNamedPartyKey("name:boda rider")).toBe(false);
  });
});

describe("suggestedPartyName", () => {
  it("offers the text as it stands, so there is something to correct", () => {
    expect(
      suggestedPartyName("name:mtnmobilemoney", [entry({ id: "a", payee: "MTNMOBILEMONEY" })]),
    ).toBe("MTNMOBILEMONEY");
  });

  it("offers nothing when there is no usable text", () => {
    expect(suggestedPartyName("name:x", [])).toBe("");
  });
});
