import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { getLedgerRows, getTransactionBalanceDelta, reconcileAccountBalances } from "@/lib/domain/accounts";
import { parseCsvText } from "@/lib/import/csv";
import type { Account, Transaction, TransactionType } from "@/lib/types";

const account: Account = {
  id: "account:property",
  userId: "user:default",
  name: "Property account",
  type: "bank",
  openingBalance: 250_000,
  balance: 250_000,
  isArchived: false,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

const dateArbitrary = fc
  .integer({
    min: Date.parse("2026-01-01T00:00:00.000Z"),
    max: Date.parse("2026-12-31T00:00:00.000Z"),
  })
  .map((value) => new Date(value));

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const transactionArbitrary = fc
  .record({
    id: fc.uuid(),
    type: fc.constantFrom<TransactionType>(
      "income",
      "expense",
      "savings_contribution",
      "debt_payment",
      "transfer",
    ),
    amount: fc.integer({ min: -500_000, max: 500_000 }).filter((value) => value !== 0),
    occurredOn: dateArbitrary.map(toIsoDate),
    categoryId: fc.constant("category:test"),
  })
  .map((entry): Transaction => {
    const amount =
      entry.type === "transfer" ? entry.amount : Math.abs(entry.amount);

    return {
      id: `transaction:${entry.id}`,
      userId: "user:default",
      accountId: account.id,
      type: entry.type,
      amount,
      currency: "UGX",
      originalAmount: Math.abs(amount),
      occurredOn: entry.occurredOn,
      categoryId: entry.categoryId,
      reconciliationState: "posted" as const,
      source: "manual" as const,
      createdAt: `${entry.occurredOn}T00:00:00.000Z`,
      updatedAt: `${entry.occurredOn}T00:00:00.000Z`,
    };
  });

describe("accounting property invariants", () => {
  it("opening balance plus deltas equals reconciled closing balance", () => {
    fc.assert(
      fc.property(fc.array(transactionArbitrary, { maxLength: 25 }), (transactions) => {
        const [reconciled] = reconcileAccountBalances([account], transactions);
        const expected = account.openingBalance + transactions.reduce(
          (sum, transaction) => sum + getTransactionBalanceDelta(transaction),
          0,
        );

        expect(reconciled.balance).toBe(expected);
      }),
    );
  });

  it("ledger final running balance matches reconciled closing balance", () => {
    fc.assert(
      fc.property(fc.array(transactionArbitrary, { maxLength: 25 }), (transactions) => {
        const [reconciled] = reconcileAccountBalances([account], transactions);
        const rows = getLedgerRows(account, transactions);
        const finalRunningBalance =
          rows.length === 0 ? account.openingBalance : rows.at(-1)?.runningBalance;

        expect(finalRunningBalance).toBe(reconciled.balance);
      }),
    );
  });

  it("transaction ordering does not change final closing balance", () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { maxLength: 25 }),
        fc.array(fc.integer({ min: 0, max: 24 }), { maxLength: 25 }),
        (transactions, order) => {
          const shuffled = [...transactions].sort((left, right) => {
            const leftIndex = order[transactions.indexOf(left)] ?? 0;
            const rightIndex = order[transactions.indexOf(right)] ?? 0;
            return leftIndex - rightIndex;
          });

          const [first] = reconcileAccountBalances([account], transactions);
          const [second] = reconcileAccountBalances([account], shuffled);

          expect(first.balance).toBe(second.balance);
        },
      ),
    );
  });

  it("csv parse remains stable for supported rows", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: dateArbitrary.map(toIsoDate),
            amount: fc.integer({ min: 1, max: 500_000 }),
            note: fc.string({ minLength: 1, maxLength: 12 }).filter(
              (value) => !/[",\n]/.test(value),
            ),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (rows) => {
          const source = [
            ["date", "amount", "note"].join(","),
            ...rows.map((row) => [row.date, String(row.amount), row.note].join(",")),
          ].join("\n");

          const firstPass = parseCsvText(source);
          const serialized = [
            firstPass.headers.join(","),
            ...firstPass.rows.map((row) => row.join(",")),
          ].join("\n");
          const secondPass = parseCsvText(serialized);

          expect(secondPass).toEqual(firstPass);
        },
      ),
    );
  });
});
