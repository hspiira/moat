import { describe, expect, it } from "vitest";

import type { Category, Transaction, TransactionRule } from "@/lib/types";

import { feesCategoryId, loanInterestCategoryId } from "@/lib/app-state/defaults";
import { deriveSeededId, isValidId } from "@/lib/ids";
import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { isSpendingTransaction } from "@/lib/domain/transfers";
import type { Account } from "@/lib/types";

import {
  buildDebtPaymentTransactions,
  buildFeeTransaction,
  buildManualTransaction,
  buildTransferPair,
  validateTransactionAmounts,
  type TransactionBuildInput,
} from "./transaction-builder";
import { createDefaultTransactionForm, type TransactionFormState } from "./transaction-form";

const baseForm: TransactionFormState = {
  ...createDefaultTransactionForm(),
  type: "expense",
  accountId: "account:source",
  destinationAccountId: "account:destination",
  categoryId: "category:food",
  currency: "UGX",
  amount: "50000",
  fxRateToUgx: "",
  occurredOn: "2026-04-10",
  payee: "Mega Standard",
  note: "groceries, weekly",
};

function buildInput(overrides: Partial<TransactionBuildInput> = {}): TransactionBuildInput {
  return {
    form: baseForm,
    userId: "user:default",
    timestamp: "2026-04-10T12:00:00.000Z",
    editingTransactionId: null,
    existingTransactions: [],
    ...overrides,
  };
}

describe("validateTransactionAmounts", () => {
  it("rejects zero, negative, and non-numeric amounts", () => {
    expect(() => validateTransactionAmounts({ ...baseForm, amount: "0" })).toThrow(
      "Amount must be greater than zero.",
    );
    expect(() => validateTransactionAmounts({ ...baseForm, amount: "-100" })).toThrow();
    expect(() => validateTransactionAmounts({ ...baseForm, amount: "abc" })).toThrow();
  });

  it("accepts a grouped amount, because that is how people type money", () => {
    // Number("1,790,590") is NaN, which used to reject a valid figure with
    // "Amount must be greater than zero".
    expect(validateTransactionAmounts({ ...baseForm, amount: "1,790,590" })).toMatchObject({
      originalAmount: 1_790_590,
      normalizedAmount: 1_790_590,
    });
  });

  it("accepts a grouped exchange rate", () => {
    const { normalizedAmount } = validateTransactionAmounts({
      ...baseForm,
      currency: "USD",
      amount: "100",
      fxRateToUgx: "3,700",
    });
    expect(normalizedAmount).toBe(370_000);
  });

  it("requires an FX rate for non-UGX currencies", () => {
    expect(() =>
      validateTransactionAmounts({ ...baseForm, currency: "USD", fxRateToUgx: "" }),
    ).toThrow("Enter a valid currency and FX rate.");
  });

  it("normalizes foreign amounts through the FX rate", () => {
    const { normalizedAmount } = validateTransactionAmounts({
      ...baseForm,
      currency: "USD",
      amount: "10",
      fxRateToUgx: "3800",
    });
    expect(normalizedAmount).toBe(38_000);
  });
});

describe("buildTransferPair", () => {
  it("carries an agreed repayment date on both legs", () => {
    const [source, destination] = buildTransferPair(
      buildInput({
        form: {
          ...baseForm,
          type: "transfer",
          payee: "Sarah",
          expectedRepaymentDate: "2026-09-01",
        },
      }),
    );

    // Both legs carry it: the loan leg is the destination when lending out and
    // the source when borrowing, and only the loan account's own leg is read.
    expect(destination.expectedRepaymentDate).toBe("2026-09-01");
    expect(source.expectedRepaymentDate).toBe("2026-09-01");
  });

  it("leaves the repayment date unset when none was agreed", () => {
    const [, destination] = buildTransferPair(
      buildInput({ form: { ...baseForm, type: "transfer", expectedRepaymentDate: "" } }),
    );

    expect(destination.expectedRepaymentDate).toBeUndefined();
  });

  it("carries the borrower's name onto both legs so lending can group by it", () => {
    const [source, destination] = buildTransferPair(
      buildInput({ form: { ...baseForm, type: "transfer", payee: "Sarah" } }),
    );

    expect(source.payee).toBe("Sarah");
    expect(destination.payee).toBe("Sarah");
  });

  it("produces a balanced pair sharing one transfer group", () => {
    const [source, destination] = buildTransferPair(
      buildInput({ form: { ...baseForm, type: "transfer" } }),
    );

    expect(source.amount + destination.amount).toBe(0);
    expect(source.amount).toBeLessThan(0);
    expect(destination.amount).toBeGreaterThan(0);
    expect(source.transferGroupId).toBe(destination.transferGroupId);
    expect(source.accountId).toBe("account:source");
    expect(destination.accountId).toBe("account:destination");
    expect(source.id).toBe(deriveSeededId(source.transferGroupId!, "source"));
    expect(destination.id).toBe(deriveSeededId(destination.transferGroupId!, "destination"));
  });

  /**
   * Editing used to be impossible for transfers, and the group id was always
   * fresh because of it. Now that the form can reopen one, a fresh group would
   * write a second balanced pair and orphan the first: the money would appear
   * to have moved twice.
   */
  it("overwrites both legs in place when editing an existing transfer", () => {
    const [source, destination] = buildTransferPair(
      buildInput({ form: { ...baseForm, type: "transfer" } }),
    );
    const stored = [source, destination];

    const [editedSource, editedDestination] = buildTransferPair(
      buildInput({
        form: { ...baseForm, type: "transfer", amount: "75000" },
        editingTransactionId: source.id,
        existingTransactions: stored,
      }),
    );

    expect(editedSource.id).toBe(source.id);
    expect(editedDestination.id).toBe(destination.id);
    expect(editedSource.transferGroupId).toBe(source.transferGroupId);
    expect(editedSource.amount + editedDestination.amount).toBe(0);
    expect(Math.abs(editedSource.amount)).toBe(75000);
  });

  it("still balances after the accounts are swapped in an edit", () => {
    const [source, destination] = buildTransferPair(
      buildInput({ form: { ...baseForm, type: "transfer" } }),
    );

    const [editedSource, editedDestination] = buildTransferPair(
      buildInput({
        form: {
          ...baseForm,
          type: "transfer",
          accountId: "account:destination",
          destinationAccountId: "account:source",
        },
        editingTransactionId: source.id,
        existingTransactions: [source, destination],
      }),
    );

    expect(editedSource.accountId).toBe("account:destination");
    expect(editedDestination.accountId).toBe("account:source");
    expect(editedSource.amount + editedDestination.amount).toBe(0);
    expect([editedSource.id, editedDestination.id].sort()).toEqual([source.id, destination.id].sort());
  });

  it("gives a brand new transfer its own group", () => {
    const [firstSource] = buildTransferPair(buildInput({ form: { ...baseForm, type: "transfer" } }));
    const [secondSource] = buildTransferPair(buildInput({ form: { ...baseForm, type: "transfer" } }));
    expect(firstSource.transferGroupId).not.toBe(secondSource.transferGroupId);
    expect(firstSource.id).not.toBe(secondSource.id);
  });

  it("rejects transfers without two distinct accounts", () => {
    expect(() =>
      buildTransferPair(
        buildInput({ form: { ...baseForm, type: "transfer", destinationAccountId: "" } }),
      ),
    ).toThrow("Transfer requires a source and destination account.");
    expect(() =>
      buildTransferPair(
        buildInput({
          form: { ...baseForm, type: "transfer", destinationAccountId: "account:source" },
        }),
      ),
    ).toThrow("Source and destination must be different accounts.");
  });

  it("generates unique transfer groups per call", () => {
    const input = buildInput({ form: { ...baseForm, type: "transfer" } });
    const [firstSource] = buildTransferPair(input);
    const [secondSource] = buildTransferPair(input);

    expect(firstSource.transferGroupId).not.toBe(secondSource.transferGroupId);
  });
});

describe("buildDebtPaymentTransactions", () => {
  const loan: Account = {
    id: "debt:sacco",
    userId: "user:default",
    name: "SACCO loan",
    type: "debt",
    openingBalance: -1_000_000,
    balance: -1_000_000,
    debtPrincipal: 1_000_000,
    debtInterestRate: 12,
    debtInterestModel: "reducing_balance",
    debtStartDate: "2026-03-11",
    isArchived: false,
    createdAt: "2026-03-11T00:00:00.000Z",
    updatedAt: "2026-03-11T00:00:00.000Z",
  };

  const paymentForm: TransactionFormState = {
    ...baseForm,
    type: "debt_payment",
    accountId: "account:source",
    destinationAccountId: loan.id,
    categoryId: "category:debt-repayment",
    amount: "100000",
    occurredOn: "2026-04-10",
  };

  function build(form: TransactionFormState = paymentForm) {
    return buildDebtPaymentTransactions(buildInput({ form }), loan);
  }

  it("takes the cash out of the paying account, all of it", () => {
    const written = build();
    const fromSource = written
      .filter((entry) => entry.accountId === "account:source")
      .reduce((total, entry) => total + getTransactionBalanceDelta(entry), 0);

    expect(fromSource).toBe(-100_000);
  });

  it("reduces the loan by the principal, so the debt actually goes down", () => {
    // The bug this replaces: a debt_payment on the debt account pushed the
    // balance further negative, and one on the cash account left it untouched.
    const written = build();
    const onLoan = written
      .filter((entry) => entry.accountId === loan.id)
      .reduce((total, entry) => total + getTransactionBalanceDelta(entry), 0);

    expect(onLoan).toBeGreaterThan(0);
    expect(loan.balance + onLoan).toBeGreaterThan(loan.balance);
  });

  it("reduces net worth by the interest only, never by the whole payment", () => {
    const written = build();
    const netWorthChange = written.reduce(
      (total, entry) => total + getTransactionBalanceDelta(entry),
      0,
    );
    const interest = written.find((entry) => entry.type === "expense");

    expect(netWorthChange).toBe(-Math.abs(interest!.amount));
  });

  it("counts only the interest as spending", () => {
    const written = build();
    const spending = written.filter(isSpendingTransaction);

    expect(spending).toHaveLength(1);
    expect(spending[0].categoryId).toBe(loanInterestCategoryId("user:default"));
  });

  it("links the principal legs as one balanced transfer", () => {
    const legs = build().filter((entry) => entry.type === "transfer");

    expect(legs).toHaveLength(2);
    expect(legs[0].amount + legs[1].amount).toBe(0);
    expect(legs[0].transferGroupId).toBe(legs[1].transferGroupId);
  });

  it("writes no interest row for an interest-free loan", () => {
    const written = buildDebtPaymentTransactions(buildInput({ form: paymentForm }), {
      ...loan,
      debtInterestRate: 0,
    });

    expect(written.filter((entry) => entry.type === "expense")).toHaveLength(0);
    expect(written).toHaveLength(2);
  });

  it("accrues interest from the last payment, not the loan start, once one exists", () => {
    const earlier = buildDebtPaymentTransactions(buildInput({ form: paymentForm }), loan);
    const withHistory = buildDebtPaymentTransactions(
      buildInput({ form: paymentForm, existingTransactions: earlier }),
      loan,
    );

    const firstInterest = earlier.find((entry) => entry.type === "expense");
    const secondInterest = withHistory.find((entry) => entry.type === "expense");

    // Same payment date, but the clock restarts at the previous payment.
    expect(secondInterest).toBeUndefined();
    expect(firstInterest).toBeDefined();
  });

  it("refuses to pay a loan from the loan itself", () => {
    expect(() =>
      build({ ...paymentForm, accountId: loan.id, destinationAccountId: loan.id }),
    ).toThrow(/different accounts/i);
  });

  it("requires a loan to pay", () => {
    expect(() => build({ ...paymentForm, destinationAccountId: "" })).toThrow(/which loan/i);
  });
});

describe("buildManualTransaction", () => {
  const catalogue: Category[] = [
    {
      id: "category:food",
      userId: "user:default",
      name: "Food",
      kind: "expense",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "category:debt-repayment",
      userId: "user:default",
      name: "Debt repayment",
      kind: "debt_repayment",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("refuses to write a debt payment against an ordinary expense category", () => {
    // The picker already hides this pair; nothing stopped a caller writing it.
    expect(() =>
      buildManualTransaction(
        buildInput({ form: { ...baseForm, type: "debt_payment", categoryId: "category:food" } }),
        [],
        catalogue,
      ),
    ).toThrow(/cannot be used for a debt payment/i);
  });

  it("writes a debt payment against a debt repayment category", () => {
    const transaction = buildManualTransaction(
      buildInput({
        form: { ...baseForm, type: "debt_payment", categoryId: "category:debt-repayment" },
      }),
      [],
      catalogue,
    );

    expect(transaction.type).toBe("debt_payment");
    expect(transaction.categoryId).toBe("category:debt-repayment");
  });

  it("rejects a transaction with no account or category selected", () => {
    expect(() =>
      buildManualTransaction(buildInput({ form: { ...baseForm, accountId: "" } }), []),
    ).toThrow("Choose an account");
    expect(() =>
      buildManualTransaction(buildInput({ form: { ...baseForm, categoryId: "" } }), []),
    ).toThrow("Choose a category");
  });

  it("builds a posted manual transaction with absolute amounts", () => {
    const transaction = buildManualTransaction(buildInput(), []);

    expect(transaction.amount).toBe(50_000);
    expect(transaction.type).toBe("expense");
    expect(transaction.reconciliationState).toBe("posted");
    expect(transaction.source).toBe("manual");
    expect(transaction.fxRateToUgx).toBeUndefined();
    expect(transaction.createdAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("preserves createdAt when editing an existing transaction", () => {
    const existing = {
      id: "transaction:existing",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Transaction;

    const transaction = buildManualTransaction(
      buildInput({
        editingTransactionId: "transaction:existing",
        existingTransactions: [existing],
      }),
      [],
    );

    expect(transaction.id).toBe("transaction:existing");
    expect(transaction.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(transaction.updatedAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("applies matching transaction rules to the proposed transaction", () => {
    const rule: TransactionRule = {
      id: "rule:groceries",
      userId: "user:default",
      name: "Groceries payee",
      enabled: true,
      priority: 1,
      payeePattern: "mega",
      effectCategoryId: "category:groceries",
      autoMarkReviewed: false,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    const transaction = buildManualTransaction(buildInput(), [rule]);
    expect(transaction.categoryId).toBe("category:groceries");
  });
});

const parentPayment: Transaction = {
  id: "transaction:abc",
  userId: "user:default",
  accountId: "account:momo",
  type: "expense",
  amount: 50_000,
  currency: "USD",
  originalAmount: 13,
  fxRateToUgx: 3846,
  occurredOn: "2026-04-10",
  categoryId: "category:food",
  reconciliationState: "posted",
  source: "manual",
  payee: "Mega Standard",
  createdAt: "2026-04-10T12:00:00.000Z",
  updatedAt: "2026-04-10T12:00:00.000Z",
};

describe("buildFeeTransaction", () => {
  it("builds a UGX fee expense linked to its parent", () => {
    const fee = buildFeeTransaction(parentPayment, "1250", feesCategoryId("user:default"));
    expect(fee).not.toBeNull();
    expect(isValidId(fee!.id)).toBe(true);
    expect(fee!.feeParentId).toBe("transaction:abc");
    expect(fee!.type).toBe("expense");
    expect(fee!.categoryId).toBe(feesCategoryId("user:default"));
    expect(fee!.accountId).toBe("account:momo");
    expect(fee!.currency).toBe("UGX");
    expect(fee!.fxRateToUgx).toBeUndefined();
    expect(fee!.amount).toBe(1250);
    expect(fee!.originalAmount).toBe(1250);
    expect(fee!.occurredOn).toBe("2026-04-10");
    expect(fee!.createdAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("returns null for blank, zero, negative, or non-numeric fees", () => {
    expect(buildFeeTransaction(parentPayment, "", feesCategoryId("user:default"))).toBeNull();
    expect(buildFeeTransaction(parentPayment, "   ", feesCategoryId("user:default"))).toBeNull();
    expect(buildFeeTransaction(parentPayment, "0", feesCategoryId("user:default"))).toBeNull();
    expect(buildFeeTransaction(parentPayment, "-5", feesCategoryId("user:default"))).toBeNull();
    expect(buildFeeTransaction(parentPayment, "abc", feesCategoryId("user:default"))).toBeNull();
  });

  /**
   * The fee used to take the id `${parent.id}:fee`, so an edit found it by
   * guessing that string. After the cuid2 migration a stored fee carries an
   * unrelated id, the guess missed, and saving added a second fee expense
   * against the same payment — the outflow was counted twice.
   */
  it("reuses the id of the fee already recorded against the payment", () => {
    const stored = buildFeeTransaction(parentPayment, "1250", feesCategoryId("user:default"))!;
    const migrated = { ...stored, id: "kf83nd0s7a2mqp1xhs9wztlb" };

    const updated = buildFeeTransaction(
      parentPayment,
      "3000",
      feesCategoryId("user:default"),
      migrated,
    );

    expect(updated!.id).toBe("kf83nd0s7a2mqp1xhs9wztlb");
    expect(updated!.amount).toBe(3000);
  });

  it("gives a first fee its own id rather than deriving one from the payment", () => {
    const fee = buildFeeTransaction(parentPayment, "1250", feesCategoryId("user:default"))!;
    expect(fee.id).not.toContain(parentPayment.id);
    expect(fee.id).not.toContain(":");
  });

  it("reads a grouped fee amount", () => {
    expect(buildFeeTransaction(parentPayment, "2,875", feesCategoryId("user:default"))).toMatchObject({
      amount: 2875,
    });
  });
});
