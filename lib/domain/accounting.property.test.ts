import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  getAccountTotals,
  getLedgerRows,
  getTransactionBalanceDelta,
  reconcileAccountBalances,
} from "@/lib/domain/accounts";
import { getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import {
  LENDING_POOL_ACCOUNT_ID,
  buildLendingPoolAccount,
  getLendingPortfolio,
} from "@/lib/domain/lending";
import {
  BORROWING_POOL_ACCOUNT_ID,
  buildBorrowingPoolAccount,
  getBorrowingPortfolio,
} from "@/lib/domain/borrowing";
import { buildTransferPair } from "@/components/transactions/transaction-builder";
import { defaultTransactionForm } from "@/components/transactions/transaction-form";
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

const receivable: Account = {
  id: "account:receivable",
  userId: "user:default",
  name: "Loan to Sarah",
  type: "receivable",
  openingBalance: 0,
  balance: 0,
  isArchived: false,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

/**
 * Drives the real production transfer builder, so these properties guard the
 * path the app actually takes when recording a loan — not a reconstruction.
 */
function buildLendingPair(amount: number, occurredOn: string): [Transaction, Transaction] {
  return buildTransferPair({
    form: {
      ...defaultTransactionForm,
      type: "transfer",
      accountId: account.id,
      destinationAccountId: receivable.id,
      categoryId: "category:transfers",
      currency: "UGX",
      amount: String(amount),
      fxRateToUgx: "",
      occurredOn,
    },
    userId: "user:default",
    timestamp: `${occurredOn}T00:00:00.000Z`,
    editingTransactionId: null,
    existingTransactions: [],
  });
}

function buildWriteOff(amount: number, occurredOn: string): Transaction {
  return {
    id: `transaction:write-off:${occurredOn}:${amount}`,
    userId: "user:default",
    accountId: receivable.id,
    type: "expense",
    amount: Math.abs(amount),
    currency: "UGX",
    originalAmount: Math.abs(amount),
    occurredOn,
    categoryId: "category:money-written-off",
    reconciliationState: "posted",
    source: "manual",
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
  };
}

const lendingAmountArbitrary = fc.integer({ min: 1, max: 5_000_000 });

/** A single leg sitting on the shared borrowing pool, attributed by payee. */
function borrowingLeg(
  amount: number,
  occurredOn: string,
  payee: string,
  suffix: string,
): Transaction {
  return {
    id: `transaction:borrowing-pool:${payee}:${suffix}`,
    userId: "user:default",
    accountId: BORROWING_POOL_ACCOUNT_ID,
    type: "transfer",
    amount,
    currency: "UGX",
    originalAmount: Math.abs(amount),
    occurredOn,
    categoryId: "category:transfers",
    reconciliationState: "posted",
    source: "manual",
    payee,
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
  };
}

/** A single leg sitting on the shared lending pool, attributed by payee. */
function poolLeg(
  amount: number,
  occurredOn: string,
  payee: string,
  suffix: string,
): Transaction {
  return {
    id: `transaction:pool:${payee}:${suffix}`,
    userId: "user:default",
    accountId: LENDING_POOL_ACCOUNT_ID,
    type: "transfer",
    amount,
    currency: "UGX",
    originalAmount: Math.abs(amount),
    occurredOn,
    categoryId: "category:transfers",
    reconciliationState: "posted",
    source: "manual",
    payee,
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
  };
}

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

  it("lending money never changes net worth", () => {
    fc.assert(
      fc.property(lendingAmountArbitrary, dateArbitrary.map(toIsoDate), (amount, occurredOn) => {
        const before = getAccountTotals(
          reconcileAccountBalances([account, receivable], []),
        ).totalBalance;
        const after = getAccountTotals(
          reconcileAccountBalances([account, receivable], buildLendingPair(amount, occurredOn)),
        ).totalBalance;

        expect(after).toBe(before);
      }),
    );
  });

  it("repaying a loan never changes net worth", () => {
    fc.assert(
      fc.property(lendingAmountArbitrary, dateArbitrary.map(toIsoDate), (amount, occurredOn) => {
        const lent = buildLendingPair(amount, occurredOn);
        // The repayment is the same pair with the legs swapped.
        const repaid = lent.map((leg) => ({ ...leg, id: `${leg.id}:repaid`, amount: -leg.amount }));

        const afterLending = getAccountTotals(
          reconcileAccountBalances([account, receivable], lent),
        ).totalBalance;
        const afterRepayment = getAccountTotals(
          reconcileAccountBalances([account, receivable], [...lent, ...repaid]),
        ).totalBalance;

        expect(afterRepayment).toBe(afterLending);
      }),
    );
  });

  it("lending and repayment are invisible to spending and the savings rate", () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { maxLength: 15 }),
        lendingAmountArbitrary,
        dateArbitrary.map(toIsoDate),
        (ordinary, amount, occurredOn) => {
          const lent = buildLendingPair(amount, occurredOn);
          const repaid = lent.map((leg) => ({
            ...leg,
            id: `${leg.id}:repaid`,
            amount: -leg.amount,
          }));

          const withoutLending = getSummaryForTransactions(ordinary, []);
          const withLending = getSummaryForTransactions([...ordinary, ...lent, ...repaid], []);

          expect(withLending.inflow).toBe(withoutLending.inflow);
          expect(withLending.outflow).toBe(withoutLending.outflow);
          expect(getSavingsRate(withLending)).toBe(getSavingsRate(withoutLending));
        },
      ),
    );
  });

  it("writing off a loan reduces net worth and counts as spending, both by its full amount", () => {
    fc.assert(
      fc.property(lendingAmountArbitrary, dateArbitrary.map(toIsoDate), (amount, occurredOn) => {
        const lent = buildLendingPair(amount, occurredOn);
        const writeOff = buildWriteOff(amount, occurredOn);

        const beforeWriteOff = reconcileAccountBalances([account, receivable], lent);
        const afterWriteOff = reconcileAccountBalances(
          [account, receivable],
          [...lent, writeOff],
        );

        expect(getAccountTotals(afterWriteOff).totalBalance).toBe(
          getAccountTotals(beforeWriteOff).totalBalance - amount,
        );

        const spendingBefore = getSummaryForTransactions(lent, []).outflow;
        const spendingAfter = getSummaryForTransactions([...lent, writeOff], []).outflow;

        expect(spendingAfter).toBe(spendingBefore + amount);
      }),
    );
  });

  it("every borrower's balance sums to the lending pool's reconciled balance", () => {
    const pool = buildLendingPoolAccount("user:default", "2026-01-01T00:00:00.000Z");

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            borrower: fc.constantFrom("Sarah", "Musa", "Cousin", "Aunt"),
            amount: fc.integer({ min: 1, max: 2_000_000 }),
            repay: fc.integer({ min: 0, max: 2_000_000 }),
            // Write-offs must be in here: they reduce both the borrower's
            // balance and the pool's, so leaving them out would let the
            // invariant hold while the write-off maths was broken.
            writeOff: fc.integer({ min: 0, max: 2_000_000 }),
            occurredOn: dateArbitrary.map(toIsoDate),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (loans) => {
          const legs = loans.flatMap((loan, index) => [
            poolLeg(loan.amount, loan.occurredOn, loan.borrower, `lend-${index}`),
            poolLeg(-loan.repay, loan.occurredOn, loan.borrower, `repay-${index}`),
            {
              ...poolLeg(loan.writeOff, loan.occurredOn, loan.borrower, `writeoff-${index}`),
              type: "expense" as const,
              categoryId: "category:money-written-off",
            },
          ]);

          const [reconciledPool] = reconcileAccountBalances([pool], legs);
          const portfolio = getLendingPortfolio([reconciledPool], legs, new Date("2026-07-29"));
          const summed = portfolio.parties.reduce((total, b) => total + b.outstanding, 0);

          // If these ever diverge, the band shows per-borrower figures that do
          // not add up to the account they all live in.
          expect(summed).toBe(reconciledPool.balance);
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

  it("every lender's balance sums to the borrowing pool's reconciled balance", () => {
    const pool = buildBorrowingPoolAccount("user:default", "2026-01-01T00:00:00.000Z");

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lender: fc.constantFrom("Grace", "Musa", "Cousin", "Chairman"),
            amount: fc.integer({ min: 1, max: 2_000_000 }),
            repay: fc.integer({ min: 0, max: 2_000_000 }),
            // Forgiveness must be in here for the same reason write-offs are on
            // the lending side: without it the invariant holds even when the
            // forgiveness maths is broken.
            forgiven: fc.integer({ min: 0, max: 2_000_000 }),
            occurredOn: dateArbitrary.map(toIsoDate),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (loans) => {
          const legs = loans.flatMap((loan, index) => [
            borrowingLeg(-loan.amount, loan.occurredOn, loan.lender, `borrow-${index}`),
            borrowingLeg(loan.repay, loan.occurredOn, loan.lender, `repay-${index}`),
            {
              ...borrowingLeg(loan.forgiven, loan.occurredOn, loan.lender, `forgiven-${index}`),
              type: "income" as const,
              categoryId: "category:debt-forgiven",
            },
          ]);

          const [reconciledPool] = reconcileAccountBalances([pool], legs);
          const portfolio = getBorrowingPortfolio([reconciledPool], legs, new Date("2026-07-29"));
          const summed = portfolio.parties.reduce((total, l) => total + l.outstanding, 0);

          // A liability is stored negative, so the rows must add up to its
          // mirror or the band shows figures that do not reconcile.
          expect(summed).toBe(-reconciledPool.balance);
        },
      ),
    );
  });
});
