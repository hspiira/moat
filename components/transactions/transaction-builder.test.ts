import { describe, expect, it } from "vitest";

import type { Transaction, TransactionRule } from "@/lib/types";

import { FEES_CATEGORY_ID } from "@/lib/app-state/defaults";

import {
  buildFeeTransaction,
  buildManualTransaction,
  buildTransferPair,
  validateTransactionAmounts,
  type TransactionBuildInput,
} from "./transaction-builder";
import { defaultTransactionForm, type TransactionFormState } from "./transaction-form";

const baseForm: TransactionFormState = {
  ...defaultTransactionForm,
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
  it("puts an agreed repayment date on the receiving leg only", () => {
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

    expect(destination.expectedRepaymentDate).toBe("2026-09-01");
    // The money-left-my-wallet leg is not the loan; only the receivable is.
    expect(source.expectedRepaymentDate).toBeUndefined();
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
    expect(source.id).toBe(`${source.transferGroupId}:source`);
    expect(destination.id).toBe(`${destination.transferGroupId}:destination`);
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

describe("buildManualTransaction", () => {
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
  it("builds a UGX fee expense linked to its parent with a deterministic id", () => {
    const fee = buildFeeTransaction(parentPayment, "1250", FEES_CATEGORY_ID);
    expect(fee).not.toBeNull();
    expect(fee!.id).toBe("transaction:abc:fee");
    expect(fee!.feeParentId).toBe("transaction:abc");
    expect(fee!.type).toBe("expense");
    expect(fee!.categoryId).toBe(FEES_CATEGORY_ID);
    expect(fee!.accountId).toBe("account:momo");
    expect(fee!.currency).toBe("UGX");
    expect(fee!.fxRateToUgx).toBeUndefined();
    expect(fee!.amount).toBe(1250);
    expect(fee!.originalAmount).toBe(1250);
    expect(fee!.occurredOn).toBe("2026-04-10");
    expect(fee!.createdAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("returns null for blank, zero, negative, or non-numeric fees", () => {
    expect(buildFeeTransaction(parentPayment, "", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "   ", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "0", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "-5", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "abc", FEES_CATEGORY_ID)).toBeNull();
  });

  it("reads a grouped fee amount", () => {
    expect(buildFeeTransaction(parentPayment, "2,875", FEES_CATEGORY_ID)).toMatchObject({
      amount: 2875,
    });
  });
});
