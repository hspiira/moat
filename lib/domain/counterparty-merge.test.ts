import { describe, expect, it } from "vitest";

import { planCounterpartyMerge } from "@/lib/domain/counterparty-merge";
import type { Counterparty, CounterpartyKind, Transaction } from "@/lib/types";

const NOW = "2026-08-17T00:00:00.000Z";

const party = (
  id: string,
  name: string,
  overrides: Partial<Counterparty> = {},
): Counterparty => ({
  id,
  userId: "u1",
  name,
  kind: "borrower" as CounterpartyKind,
  isArchived: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const loan = (id: string, counterpartyId: string): Transaction => ({
  id,
  userId: "u1",
  accountId: "account:money-lent-out",
  type: "transfer",
  amount: 1000,
  currency: "UGX",
  originalAmount: 1000,
  occurredOn: "2026-08-01",
  categoryId: "category:lending",
  reconciliationState: "posted",
  source: "manual",
  counterpartyId,
  createdAt: NOW,
  updatedAt: NOW,
});

describe("planCounterpartyMerge", () => {
  it("leaves distinct people alone", () => {
    const plan = planCounterpartyMerge(
      [party("c:1", "Kirkman"), party("c:2", "Joe")],
      [loan("t:1", "c:1")],
      NOW,
    );
    expect(plan).toEqual({ counterparties: [], transactions: [], removedIds: [] });
  });

  it("collapses four records for one person and repoints every transaction", () => {
    const plan = planCounterpartyMerge(
      [
        party("c:b", "Kirkman", { createdAt: "2026-08-06T22:36:00.000Z" }),
        party("c:a", "Kirkman", { createdAt: "2026-08-06T22:34:32.000Z" }),
        party("c:c", "Kirkman", { createdAt: "2026-08-06T22:38:16.000Z" }),
        party("c:d", "Kirkman", { createdAt: "2026-08-06T22:43:44.000Z" }),
      ],
      [loan("t:1", "c:a"), loan("t:2", "c:b"), loan("t:3", "c:c"), loan("t:4", "c:d")],
      NOW,
    );

    expect(plan.counterparties).toHaveLength(1);
    expect(plan.counterparties[0].id).toBe("c:a");
    expect(plan.removedIds.sort()).toEqual(["c:b", "c:c", "c:d"]);
    expect(plan.transactions.map((entry) => entry.counterpartyId)).toEqual([
      "c:a",
      "c:a",
      "c:a",
    ]);
  });

  it("does not depend on the order records are read in", () => {
    const records = [
      party("c:z", "Kirkman", { createdAt: "2026-08-02T00:00:00.000Z" }),
      party("c:a", "Kirkman", { createdAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const forwards = planCounterpartyMerge(records, [], NOW);
    const backwards = planCounterpartyMerge([...records].reverse(), [], NOW);

    expect(forwards.counterparties[0].id).toBe("c:a");
    expect(backwards.counterparties[0].id).toBe("c:a");
  });

  it("matches on name the way the app already does", () => {
    const plan = planCounterpartyMerge(
      [party("c:1", "Kirkman"), party("c:2", "  kirkman ")],
      [],
      NOW,
    );
    expect(plan.removedIds).toEqual(["c:2"]);
  });

  it("keeps both roles when the same person lent and borrowed", () => {
    const plan = planCounterpartyMerge(
      [party("c:1", "Kirkman", { kind: "borrower" }), party("c:2", "Kirkman", { kind: "lender" })],
      [],
      NOW,
    );
    expect(plan.counterparties[0].kind).toBe("both");
  });

  it("adds up the opening balance each copy carried", () => {
    const plan = planCounterpartyMerge(
      [
        party("c:1", "Kirkman", { openingBalance: 50000 }),
        party("c:2", "Kirkman", { openingBalance: 25000 }),
      ],
      [],
      NOW,
    );
    expect(plan.counterparties[0].openingBalance).toBe(75000);
  });

  it("keeps a phone or note that only one copy had", () => {
    const plan = planCounterpartyMerge(
      [party("c:1", "Kirkman"), party("c:2", "Kirkman", { phone: "0700000000", notes: "school" })],
      [],
      NOW,
    );
    expect(plan.counterparties[0].phone).toBe("0700000000");
    expect(plan.counterparties[0].notes).toBe("school");
  });

  it("stays archived only when every copy was", () => {
    const bothArchived = planCounterpartyMerge(
      [
        party("c:1", "Kirkman", { isArchived: true }),
        party("c:2", "Kirkman", { isArchived: true }),
      ],
      [],
      NOW,
    );
    const oneActive = planCounterpartyMerge(
      [
        party("c:1", "Kirkman", { isArchived: true }),
        party("c:2", "Kirkman", { isArchived: false }),
      ],
      [],
      NOW,
    );

    expect(bothArchived.counterparties[0].isArchived).toBe(true);
    expect(oneActive.counterparties[0].isArchived).toBe(false);
  });

  it("leaves transactions pointing at a survivor untouched", () => {
    const plan = planCounterpartyMerge(
      [party("c:1", "Kirkman"), party("c:2", "Kirkman")],
      [loan("t:1", "c:1")],
      NOW,
    );
    expect(plan.transactions).toEqual([]);
  });
});
