import { isEditableTransaction, transferLegs } from "@/lib/domain/transaction-cascade";
import type { Transaction } from "@/lib/types";
import type { TransactionFormState } from "./transaction-form";

export type TransactionEdit = {
  editingId: string;
  form: TransactionFormState;
};

export function buildTransactionEdit(
  transaction: Transaction,
  transactions: Transaction[],
): TransactionEdit | null {
  if (!isEditableTransaction(transaction, transactions)) {
    return null;
  }

  if (transaction.type !== "transfer") {
    return { editingId: transaction.id, form: fillForm(transaction, transactions) };
  }

  const legs = transferLegs(transaction, transactions);
  if (!legs) return null;

  const { source, destination } = legs;
  return {
    editingId: source.id,
    form: {
      ...fillForm(source, transactions),
      destinationAccountId: destination.accountId,
      counterpartyId: source.counterpartyId ?? destination.counterpartyId ?? "",
      amount: String(Math.abs(source.originalAmount)),
      expectedRepaymentDate:
        source.expectedRepaymentDate ?? destination.expectedRepaymentDate ?? "",
    },
  };
}

function fillForm(row: Transaction, transactions: Transaction[]): TransactionFormState {
  const fee = transactions.find((entry) => entry.feeParentId === row.id);
  return {
    type: row.type,
    accountId: row.accountId,
    destinationAccountId: "",
    categoryId: row.categoryId,
    currency: row.currency,
    payee: row.payee ?? row.rawPayee ?? "",
    counterpartyId: row.counterpartyId ?? "",
    counterpartyName: "",
    amount: String(row.originalAmount),
    fxRateToUgx: row.fxRateToUgx ? String(row.fxRateToUgx) : "",
    feeAmount: fee ? String(fee.originalAmount) : "",
    occurredOn: row.occurredOn,
    expectedRepaymentDate: "",
    note: row.note ?? "",
  };
}
