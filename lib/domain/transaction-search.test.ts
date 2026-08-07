import { describe, expect, it } from "vitest";

import { searchTransactions } from "@/lib/domain/transaction-search";
import type { Account, Category, Transaction } from "@/lib/types";

const accounts = [
  { id: "a1", name: "Pocket Change" },
  { id: "a2", name: "Absa" },
] as Account[];

const categories = [
  { id: "c1", name: "Transport" },
  { id: "c2", name: "Food" },
] as Category[];

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    userId: "u1",
    accountId: "a1",
    categoryId: "c1",
    type: "expense",
    amount: 8_000,
    occurredOn: "2026-08-05",
    note: "",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  } as Transaction;
}

const rows = [
  transaction({ payee: "Boda Guy", amount: 8_000 }),
  transaction({ payee: "Century Cinemax", categoryId: "c2", amount: 19_000 }),
  transaction({ rawPayee: "MTN MoMo", accountId: "a2", amount: 50_000, note: "airtime" }),
];

describe("searchTransactions", () => {
  it("returns everything for a blank query", () => {
    expect(searchTransactions(rows, "  ", accounts, categories)).toHaveLength(3);
  });

  it("matches the payee case-insensitively", () => {
    const found = searchTransactions(rows, "boda", accounts, categories);
    expect(found).toHaveLength(1);
    expect(found[0].payee).toBe("Boda Guy");
  });

  it("matches raw payee, note, category, and account names", () => {
    expect(searchTransactions(rows, "momo", accounts, categories)).toHaveLength(1);
    expect(searchTransactions(rows, "airtime", accounts, categories)).toHaveLength(1);
    expect(searchTransactions(rows, "food", accounts, categories)).toHaveLength(1);
    expect(searchTransactions(rows, "absa", accounts, categories)).toHaveLength(1);
  });

  it("matches amounts by digits, ignoring separators", () => {
    expect(searchTransactions(rows, "19,000", accounts, categories)).toHaveLength(1);
    expect(searchTransactions(rows, "8000", accounts, categories)).toHaveLength(1);
  });

  it("requires every word to match, narrowing the result", () => {
    expect(searchTransactions(rows, "boda 8000", accounts, categories)).toHaveLength(1);
    expect(searchTransactions(rows, "boda absa", accounts, categories)).toHaveLength(0);
  });
});
