import { describe, expect, it } from "vitest";

import type { Transaction, TransactionRule } from "@/lib/types";

import {
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
