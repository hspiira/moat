import { normalizeAmountToUgx } from "@/lib/currency";
import { parseAmountInput } from "@/lib/parse-amount";
import { applyTransactionRules } from "@/lib/domain/rules";
import { lastLoanPaymentOn, splitDebtPayment } from "@/lib/domain/debt-payment";
import { assertCategoryMatchesType } from "@/lib/domain/transaction-classification";
import { loanInterestCategoryId } from "@/lib/app-state/defaults";
import type { Account, Category, Transaction, TransactionRule } from "@/lib/types";

import type { TransactionFormState } from "./transaction-form";
import { createId, deriveSeededId } from "@/lib/ids";

export type TransactionBuildInput = {
  form: TransactionFormState;
  userId: string;
  timestamp: string;
  editingTransactionId: string | null;
  existingTransactions: Transaction[];
};

export function validateTransactionAmounts(form: TransactionFormState): {
  originalAmount: number;
  normalizedAmount: number;
} {
  const originalAmount = parseAmountInput(form.amount) ?? Number.NaN;
  const normalizedAmount = normalizeAmountToUgx(
    originalAmount,
    form.currency,
    parseAmountInput(form.fxRateToUgx) ?? 0,
  );

  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (form.currency === "UGX" && !Number.isInteger(originalAmount)) {
    throw new Error("Enter a whole number of shillings.");
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
    fxRateToUgx:
      form.currency === "UGX" ? undefined : (parseAmountInput(form.fxRateToUgx) ?? undefined),
    occurredOn: form.occurredOn,
    categoryId: form.categoryId,
    payee: form.payee.trim() || undefined,
    rawPayee: form.payee.trim() || undefined,
    note: form.note.trim() || undefined,
    projectId: form.projectId || undefined,
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

export function buildTransferPair(input: TransactionBuildInput): [Transaction, Transaction] {
  const { form, userId } = input;
  const { originalAmount, normalizedAmount } = validateTransactionAmounts(form);

  if (!form.accountId || !form.destinationAccountId) {
    throw new Error("Transfer requires a source and destination account.");
  }
  if (form.accountId === form.destinationAccountId) {
    throw new Error("Source and destination must be different accounts.");
  }

  const edited = input.editingTransactionId
    ? input.existingTransactions.find(
        (transaction) => transaction.id === input.editingTransactionId,
      )
    : undefined;
  const transferGroupId = edited?.transferGroupId ?? createId();
  const sourceId = deriveSeededId(transferGroupId, "source");
  const destinationId = deriveSeededId(transferGroupId, "destination");
  const shared = sharedTransactionFields(input, originalAmount);

  return [
    {
      id: sourceId,
      userId,
      accountId: form.accountId,
      type: "transfer",
      amount: -Math.abs(normalizedAmount),
      transferGroupId,
      expectedRepaymentDate: form.expectedRepaymentDate || undefined,
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
      expectedRepaymentDate: form.expectedRepaymentDate || undefined,
      createdAt: preservedCreatedAt(input, destinationId),
      ...shared,
    },
  ];
}

export function buildManualTransaction(
  input: TransactionBuildInput,
  rules: TransactionRule[],
  categories?: Category[],
): Transaction {
  const { form, userId } = input;
  const { originalAmount, normalizedAmount } = validateTransactionAmounts(form);

  if (!form.accountId) {
    throw new Error("Choose an account for this transaction.");
  }
  if (!form.categoryId) {
    throw new Error("Choose a category for this transaction.");
  }
  if (categories) {
    assertCategoryMatchesType(categories, form.type, form.categoryId);
  }

  const transactionId = input.editingTransactionId ?? createId();

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

export function buildDebtPaymentTransactions(
  input: TransactionBuildInput,
  loan: Account,
): Transaction[] {
  const { form, userId } = input;
  const { originalAmount, normalizedAmount } = validateTransactionAmounts(form);

  if (!form.accountId) {
    throw new Error("Choose the account you are paying from.");
  }
  if (!form.destinationAccountId) {
    throw new Error("Choose which loan you are paying.");
  }
  if (form.accountId === form.destinationAccountId) {
    throw new Error("A loan cannot be paid from itself — choose different accounts.");
  }

  const previousPaymentOn = lastLoanPaymentOn(loan.id, input.existingTransactions);
  const split = splitDebtPayment({
    account: loan,
    paymentAmount: normalizedAmount,
    occurredOn: form.occurredOn,
    previousPaymentOn,
  });

  if (!split) {
    throw new Error(`${loan.name} is not a debt account.`);
  }

  const groupId = createId();
  const shared = sharedTransactionFields(input, originalAmount);
  const towardsLoan = split.principal + split.overpayment;
  const rows: Transaction[] = [];

  if (towardsLoan > 0) {
    rows.push(
      {
        id: deriveSeededId(groupId, "source"),
        userId,
        accountId: form.accountId,
        type: "transfer",
        amount: -towardsLoan,
        transferGroupId: groupId,
        createdAt: preservedCreatedAt(input, deriveSeededId(groupId, "source")),
        ...shared,
        originalAmount: towardsLoan,
      },
      {
        id: deriveSeededId(groupId, "destination"),
        userId,
        accountId: loan.id,
        type: "transfer",
        amount: towardsLoan,
        transferGroupId: groupId,
        createdAt: preservedCreatedAt(input, deriveSeededId(groupId, "destination")),
        ...shared,
        originalAmount: towardsLoan,
      },
    );
  }

  if (split.interest > 0) {
    rows.push({
      id: deriveSeededId(groupId, "interest"),
      userId,
      accountId: form.accountId,
      type: "expense",
      transferGroupId: groupId,
      amount: split.interest,
      createdAt: preservedCreatedAt(input, deriveSeededId(groupId, "interest")),
      ...shared,
      originalAmount: split.interest,
      categoryId: loanInterestCategoryId(userId),
      note: form.note.trim() || `Interest on ${loan.name}`,
    });
  }

  return rows;
}

export function buildFeeTransaction(
  parent: Transaction,
  feeAmountRaw: string,
  feesCategoryId: string,
  existingFee?: Transaction,
): Transaction | null {
  const value = parseAmountInput(feeAmountRaw) ?? Number.NaN;
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    id: existingFee?.id ?? createId(),
    userId: parent.userId,
    accountId: parent.accountId,
    type: "expense",
    amount: value,
    currency: "UGX",
    originalAmount: value,
    fxRateToUgx: undefined,
    occurredOn: parent.occurredOn,
    categoryId: feesCategoryId,
    reconciliationState: "posted",
    source: parent.source,
    payee: parent.payee,
    note: "Fee / charges",
    feeParentId: parent.id,
    projectId: parent.projectId,
    reviewedAt: parent.updatedAt,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
  };
}
