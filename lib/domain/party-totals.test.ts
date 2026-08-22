import { describe, expect, it } from "vitest";

import {
  findPartyPriceRises,
  findSmallButAddsUp,
  getPartyMovement,
  partyKeyOf,
} from "@/lib/domain/party-totals";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Counterparty, Transaction } from "@/lib/types";

const USER = "user:default";

function entry(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "account:momo",
    type: "expense",
    amount: 3_000,
    currency: "UGX",
    originalAmount: 3_000,
    occurredOn: "2026-08-05",
    categoryId: "category:transport",
    reconciliationState: "posted",
    source: "sms",
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt: "2026-08-05T08:00:00.000Z",
    ...values,
  };
}

const shop: Counterparty = {
  id: "party:stall",
  userId: USER,
  name: "Nakawa Market Stall",
  kind: "none",
  nature: "business",
  isArchived: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("partyKeyOf", () => {
  it("prefers a named party over the text on the row", () => {
    expect(partyKeyOf(entry({ id: "a", counterpartyId: "party:stall", payee: "STALL" }))).toBe(
      "party:party:stall",
    );
  });

  it("falls back to the payee, so rows never named still group", () => {
    expect(partyKeyOf(entry({ id: "a", payee: "Boda Rider" }))).toBe("name:boda rider");
  });

  it("treats the same name written differently as one party", () => {
    expect(partyKeyOf(entry({ id: "a", payee: "Boda Rider" }))).toBe(
      partyKeyOf(entry({ id: "b", payee: "  boda rider " })),
    );
  });

  it("has no party for a row with nothing to go on", () => {
    expect(partyKeyOf(entry({ id: "a" }))).toBeNull();
  });
});

describe("getPartyMovement", () => {
  it("keeps who took money apart from who paid you", () => {
    const movement = getPartyMovement(
      [
        entry({ id: "spent", payee: "Boda Rider", amount: 3_000 }),
        entry({ id: "earned", payee: "Employer", type: "income", amount: 900_000 }),
      ],
      [],
    );

    expect(movement.out.map((party) => party.name)).toEqual(["Boda Rider"]);
    expect(movement.in.map((party) => party.name)).toEqual(["Employer"]);
  });

  it("uses the party's real name once one is set", () => {
    const movement = getPartyMovement(
      [entry({ id: "a", counterpartyId: shop.id, payee: "STALL 077" })],
      [shop],
    );

    expect(movement.out[0].name).toBe("Nakawa Market Stall");
  });

  it("ignores moving money between your own accounts", () => {
    const movement = getPartyMovement(
      [entry({ id: "a", type: "transfer", amount: -500_000, payee: "Own Transfer" })],
      [],
    );

    expect(movement.out).toEqual([]);
  });

  it("shows what one payment costs, not counting the charge as a payment", () => {
    const movement = getPartyMovement(
      [
        entry({ id: "a", payee: "Airtime Top Up", amount: 5_000 }),
        entry({ id: "b", payee: "Airtime Top Up", amount: 5_000 }),
        entry({
          id: "fee",
          payee: "Airtime Top Up",
          amount: 500,
          categoryId: feesCategoryId(USER),
        }),
      ],
      [],
    );

    expect(movement.out[0]).toMatchObject({
      amount: 10_500,
      count: 2,
      perTime: 5_000,
      fees: 500,
    });
  });

  it("does not count a charge as a payment even when it comes first", () => {
    const movement = getPartyMovement(
      [
        entry({
          id: "fee",
          payee: "Airtime Top Up",
          amount: 500,
          categoryId: feesCategoryId(USER),
        }),
        entry({ id: "a", payee: "Airtime Top Up", amount: 5_000 }),
      ],
      [],
    );

    expect(movement.out[0]).toMatchObject({ count: 1, perTime: 5_000, fees: 500 });
  });

  it("names every category a party takes money under", () => {
    const movement = getPartyMovement(
      [
        entry({ id: "a", payee: "Market Stall", categoryId: "category:food" }),
        entry({ id: "b", payee: "Market Stall", categoryId: "category:transport" }),
        entry({ id: "c", payee: "Market Stall", categoryId: "category:food" }),
      ],
      [],
    );

    expect(movement.out[0].categoryIds).toEqual(["category:food", "category:transport"]);
  });

  it("puts the biggest taker first", () => {
    const movement = getPartyMovement(
      [
        entry({ id: "a", payee: "Small", amount: 1_000 }),
        entry({ id: "b", payee: "Big", amount: 90_000 }),
      ],
      [],
    );

    expect(movement.out.map((party) => party.name)).toEqual(["Big", "Small"]);
  });
});

describe("findPartyPriceRises", () => {
  const now = [
    entry({ id: "n1", payee: "Boda Rider", amount: 4_000 }),
    entry({ id: "n2", payee: "Boda Rider", amount: 4_000 }),
  ];
  const before = [
    entry({ id: "b1", payee: "Boda Rider", amount: 3_000, occurredOn: "2026-07-05" }),
    entry({ id: "b2", payee: "Boda Rider", amount: 3_000, occurredOn: "2026-07-06" }),
  ];

  it("catches a party charging more each time", () => {
    const rises = findPartyPriceRises(now, before, []);

    expect(rises).toHaveLength(1);
    expect(rises[0]).toMatchObject({ wasPerTime: 3_000, nowPerTime: 4_000 });
  });

  it("does not call it a rise when you simply went more often", () => {
    const rises = findPartyPriceRises([...now, ...now.map((row) => ({ ...row, id: `${row.id}x` }))], now, []);

    expect(rises).toEqual([]);
  });

  it("says nothing about a party with no earlier figure", () => {
    expect(findPartyPriceRises(now, [], [])).toEqual([]);
  });
});

describe("findSmallButAddsUp", () => {
  it("finds the party no single payment would flag", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      entry({ id: `boda-${index}`, payee: "Boda Rider", amount: 3_000 }),
    );

    const found = findSmallButAddsUp(rows, []);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Boda Rider", count: 6, amount: 18_000 });
  });

  it("leaves alone a party you paid once, however small", () => {
    expect(findSmallButAddsUp([entry({ id: "a", payee: "Kiosk", amount: 500 })], [])).toEqual([]);
  });

  it("leaves alone a party whose single payments are large", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      entry({ id: `rent-${index}`, payee: "Landlord", amount: 800_000 }),
    );

    expect(findSmallButAddsUp(rows, [])).toEqual([]);
  });
});
