import { describe, expect, it } from "vitest";

import {
  backfillCounterparties,
  buildCounterparty,
  counterpartyMatchKey,
  findCounterpartyByName,
  normalizeCounterpartyName,
  resolveCounterparty,
  widenKind,
} from "@/lib/domain/counterparties";
import { borrowingPoolAccountId } from "@/lib/domain/borrowing";
import { lendingPoolAccountId } from "@/lib/domain/lending";
import type { Counterparty, CounterpartyKind, Transaction } from "@/lib/types";

const TIMESTAMP = "2026-08-06T00:00:00.000Z";

function party(id: string, name: string, kind: CounterpartyKind = "borrower"): Counterparty {
  return buildCounterparty({ id, userId: "user:default", name, kind, timestamp: TIMESTAMP });
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx:1",
    userId: "user:default",
    accountId: lendingPoolAccountId("user:default"),
    type: "transfer",
    amount: 100_000,
    currency: "UGX",
    originalAmount: 100_000,
    occurredOn: "2026-05-01",
    categoryId: "category:lending",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

const poolKinds = new Map<string, CounterpartyKind>([
  [lendingPoolAccountId("user:default"), "borrower"],
  [borrowingPoolAccountId("user:default"), "lender"],
]);

describe("counterparty names", () => {
  it("collapses whitespace without changing what is displayed", () => {
    expect(normalizeCounterpartyName("  Auntie   Grace ")).toBe("Auntie Grace");
    expect(counterpartyMatchKey(" AUNTIE   grace ")).toBe("auntie grace");
  });

  it("matches an existing party however the name was typed", () => {
    const parties = [party("counterparty:1", "Auntie Grace")];

    expect(findCounterpartyByName(parties, "auntie  GRACE")?.id).toBe("counterparty:1");
    expect(findCounterpartyByName(parties, "Musa")).toBeUndefined();
  });
});

describe("widenKind", () => {
  it("keeps one role and widens to both when the other appears", () => {
    expect(widenKind("borrower", "borrower")).toBe("borrower");
    expect(widenKind("borrower", "lender")).toBe("both");
    expect(widenKind("both", "lender")).toBe("both");
  });
});

describe("resolveCounterparty", () => {
  it("creates one when the name is new", () => {
    const result = resolveCounterparty([], {
      name: "Musa",
      kind: "borrower",
      userId: "user:default",
      id: "counterparty:new",
      timestamp: TIMESTAMP,
    });

    expect(result.changed).toBe(true);
    expect(result.counterparty.name).toBe("Musa");
    expect(result.counterparty.kind).toBe("borrower");
  });

  it("reuses an existing one instead of creating a near-duplicate", () => {
    const existing = party("counterparty:1", "Auntie Grace");

    const result = resolveCounterparty([existing], {
      name: "auntie grace",
      kind: "borrower",
      userId: "user:default",
      id: "counterparty:unused",
      timestamp: TIMESTAMP,
    });

    expect(result.changed).toBe(false);
    expect(result.counterparty.id).toBe("counterparty:1");
  });

  it("widens the role when the same person appears on the other side", () => {
    const existing = party("counterparty:1", "Musa", "borrower");

    const result = resolveCounterparty([existing], {
      name: "Musa",
      kind: "lender",
      userId: "user:default",
      id: "counterparty:unused",
      timestamp: TIMESTAMP,
    });

    // Widening is a change: the stored record now needs writing back.
    expect(result.changed).toBe(true);
    expect(result.counterparty.kind).toBe("both");
  });
});

describe("backfillCounterparties", () => {
  function run(transactions: Transaction[], existing: Counterparty[] = []) {
    let seq = 0;
    return backfillCounterparties({
      transactions,
      existing,
      poolKinds,
      userId: "user:default",
      timestamp: TIMESTAMP,
      nextId: () => `counterparty:${(seq += 1)}`,
    });
  }

  it("turns each distinct payee into one record and stamps its id", () => {
    const result = run([
      transaction({ id: "tx:1", payee: "Sarah" }),
      transaction({ id: "tx:2", payee: "sarah " }),
      transaction({ id: "tx:3", payee: "Musa" }),
    ]);

    expect(result.counterparties).toHaveLength(2);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0].counterpartyId).toBe(result.transactions[1].counterpartyId);
    expect(result.transactions[2].counterpartyId).not.toBe(result.transactions[0].counterpartyId);
  });

  it("assigns the role from which pool the record sits in", () => {
    const result = run([
      transaction({ id: "tx:1", payee: "Sarah" }),
      transaction({ id: "tx:2", accountId: borrowingPoolAccountId("user:default"), payee: "Grace" }),
    ]);

    expect(result.counterparties.find((entry) => entry.name === "Sarah")?.kind).toBe("borrower");
    expect(result.counterparties.find((entry) => entry.name === "Grace")?.kind).toBe("lender");
  });

  it("gives one person both roles rather than two records", () => {
    const result = run([
      transaction({ id: "tx:1", payee: "Musa" }),
      transaction({ id: "tx:2", accountId: borrowingPoolAccountId("user:default"), payee: "Musa" }),
    ]);

    expect(result.counterparties).toHaveLength(1);
    expect(result.counterparties[0].kind).toBe("both");
  });

  it("leaves records alone that have no payee or are already stamped", () => {
    const result = run([
      transaction({ id: "tx:1" }),
      transaction({ id: "tx:2", payee: "   " }),
      transaction({ id: "tx:3", payee: "Sarah", counterpartyId: "counterparty:existing" }),
    ]);

    expect(result.counterparties).toEqual([]);
    expect(result.transactions).toEqual([]);
  });

  it("ignores records that are not in a pool", () => {
    const result = run([transaction({ id: "tx:1", accountId: "account:wallet", payee: "Shop" })]);

    expect(result.counterparties).toEqual([]);
    expect(result.transactions).toEqual([]);
  });

  it("reuses a party that already exists rather than duplicating it", () => {
    const result = run(
      [transaction({ id: "tx:1", payee: "Auntie Grace" })],
      [party("counterparty:1", "auntie grace")],
    );

    expect(result.counterparties).toEqual([]);
    expect(result.transactions[0].counterpartyId).toBe("counterparty:1");
  });
});
