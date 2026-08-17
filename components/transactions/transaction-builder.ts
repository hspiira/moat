// Pure construction and validation for manual transaction entry. Extracted
// from the workspace hook so the money-critical paths are unit-testable.

import { normalizeAmountToUgx } from "@/lib/currency";
import { parseAmountInput } from "@/lib/parse-amount";
import { applyTransactionRules } from "@/lib/domain/rules";
import { splitDebtPayment } from "@/lib/domain/debt-payment";
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
  /** Existing transactions, used to preserve createdAt when editing. */
  existingTransactions: Transaction[];
};

export function validateTransactionAmounts(form: TransactionFormState): {
  originalAmount: number;
  normalizedAmount: number;
} {
  // parseAmountInput, not Number(): people type "1,790,590", and Number() reads
  // any thousands separator as NaN, which surfaced as "Amount must be greater
  // than zero" on a perfectly good figure.
  const originalAmount = parseAmountInput(form.amount) ?? Number.NaN;
  const normalizedAmount = normalizeAmountToUgx(
    originalAmount,
    form.currency,
    parseAmountInput(form.fxRateToUgx) ?? 0,
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
  const transferGroupId = createId();
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
      // Carried on both legs because the loan leg is the destination when
      // lending out and the source when borrowing. Only the loan account's own
      // leg is ever read, so the other copy is inert.
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

/**
 * Builds a manual (non-transfer) transaction with rules applied.
 *
 * `categories` is optional only so existing callers that have no catalogue to
 * hand keep working; pass it wherever one is available. Without it the
 * type/category pair goes unchecked, which is what allowed a debt payment to be
 * filed under Food.
 */
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

/** Payment dates already recorded against a loan, oldest first. */
function getLoanPaymentDates(loanId: string, transactions: Transaction[]): string[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.accountId === loanId &&
        (transaction.type === "transfer" || transaction.type === "debt_payment"),
    )
    .map((transaction) => transaction.occurredOn)
    .sort();
}

/**
 * Builds the rows for a loan payment: a balanced transfer pair for the
 * principal, plus an interest expense when interest has accrued.
 *
 * This replaces the single `debt_payment` row, which could not work in either
 * placement. On the debt account its delta pushed the balance further negative,
 * so paying a loan made the debt grow. On the cash account the loan balance
 * never moved and `getDebtPayments` — which filters by the debt account's id —
 * found nothing, so "total paid" stayed at zero.
 *
 * The split needs nothing from the user: the rate, model, balance and start date
 * are already on the account.
 */
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

  const previousPaymentOn = getLoanPaymentDates(loan.id, input.existingTransactions).at(-1) ?? null;
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
  // Anything paid beyond the balance still moves into the loan, so the pair
  // stays balanced and the account can go positive rather than money vanishing.
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

/**
 * Builds the linked fee expense for a payment. The fee is always a UGX expense
 * in the fees category, sharing the parent's account and date, with a
 * deterministic id so edits upsert in place and deletes are derivable.
 * Returns null when no positive fee was entered.
 */
export function buildFeeTransaction(
  parent: Transaction,
  feeAmountRaw: string,
  feesCategoryId: string,
  /**
   * The fee already recorded against this payment, found by `feeParentId`.
   * Reusing its id is what makes saving an edit overwrite the fee instead of
   * adding a second one.
   */
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
    reviewedAt: parent.updatedAt,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
  };
}
