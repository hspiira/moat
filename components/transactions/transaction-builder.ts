// Pure construction and validation for manual transaction entry. Extracted
// from the workspace hook so the money-critical paths are unit-testable.

import { normalizeAmountToUgx } from "@/lib/currency";
import { applyTransactionRules } from "@/lib/domain/rules";
import type { Transaction, TransactionRule } from "@/lib/types";

import type { TransactionFormState } from "./transaction-form";

export type TransactionBuildInput = {
  form: TransactionFormState;
  userId: string;
  timestamp: string;
  editingTransactionId: string | null;
  /** Existing transactions, used to preserve createdAt when editing. */
  existingTransactions: Transaction[];
};

export function validateTransactionAmounts(form: TransactionFormState): {
  originalAmount: number;
  normalizedAmount: number;
} {
  const originalAmount = Number(form.amount);
  const normalizedAmount = normalizeAmountToUgx(
    originalAmount,
    form.currency,
    Number(form.fxRateToUgx || 0),
  );

  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Enter a valid currency and FX rate.");
  }

  return { originalAmount, normalizedAmount };
}

function sharedTransactionFields(input: TransactionBuildInput, originalAmount: number) {
  const { form } = input;
  return {
    currency: form.currency,
    originalAmount: Math.abs(originalAmount),
    fxRateToUgx: form.currency === "UGX" ? undefined : Number(form.fxRateToUgx),
    occurredOn: form.occurredOn,
    categoryId: form.categoryId,
    payee: form.payee.trim() || undefined,
    rawPayee: form.payee.trim() || undefined,
    note: form.note.trim() || undefined,
    reconciliationState: "posted" as const,
    source: "manual" as const,
    updatedAt: input.timestamp,
  };
}

function preservedCreatedAt(input: TransactionBuildInput, id: string): string {
  return (
    input.existingTransactions.find((transaction) => transaction.id === id)?.createdAt ??
    input.timestamp
  );
}

/**
 * Builds the balanced source/destination pair for a transfer. The pair
 * always sums to zero and shares one transferGroupId.
 */
export function buildTransferPair(input: TransactionBuildInput): [Transaction, Transaction] {
  const { form, userId } = input;
  const { originalAmount, normalizedAmount } = validateTransactionAmounts(form);

  if (!form.accountId || !form.destinationAccountId) {
    throw new Error("Transfer requires a source and destination account.");
  }
  if (form.accountId === form.destinationAccountId) {
    throw new Error("Source and destination must be different accounts.");
  }

  // Transfers always get a fresh group id: transfer pairs cannot be edited
  // in place (beginTransactionEdit blocks transfers), so reusing the id of
  // an edited non-transfer transaction would collide across edits.
  const transferGroupId = `transfer:${crypto.randomUUID()}`;
  const sourceId = `${transferGroupId}:source`;
  const destinationId = `${transferGroupId}:destination`;
  const shared = sharedTransactionFields(input, originalAmount);

  return [
    {
      id: sourceId,
      userId,
      accountId: form.accountId,
      type: "transfer",
      amount: -Math.abs(normalizedAmount),
      transferGroupId,
      createdAt: preservedCreatedAt(input, sourceId),
      ...shared,
    },
    {
      id: destinationId,
      userId,
      accountId: form.destinationAccountId,
      type: "transfer",
      amount: Math.abs(normalizedAmount),
      transferGroupId,
      createdAt: preservedCreatedAt(input, destinationId),
      ...shared,
    },
  ];
}

/** Builds a manual (non-transfer) transaction with rules applied. */
export function buildManualTransaction(
  input: TransactionBuildInput,
  rules: TransactionRule[],
): Transaction {
  const { form, userId } = input;
  const { originalAmount, normalizedAmount } = validateTransactionAmounts(form);
  const transactionId = input.editingTransactionId ?? `transaction:${crypto.randomUUID()}`;

  const baseTransaction: Transaction = {
    id: transactionId,
    userId,
    accountId: form.accountId,
    type: form.type,
    amount: Math.abs(normalizedAmount),
    reviewedAt: input.timestamp,
    createdAt: preservedCreatedAt(input, transactionId),
    ...sharedTransactionFields(input, originalAmount),
  };

  return applyTransactionRules(baseTransaction, rules)?.proposedTransaction ?? baseTransaction;
}
