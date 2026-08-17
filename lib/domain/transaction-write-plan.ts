import {
  buildDebtPaymentTransactions,
  buildFeeTransaction,
  buildManualTransaction,
  buildTransferPair,
  type TransactionBuildInput,
} from "@/components/transactions/transaction-builder";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import { transactionGroup } from "@/lib/domain/transaction-cascade";
import type { Account, Category, Counterparty, Transaction, TransactionRule } from "@/lib/types";

export type TransactionWritePlan = {
  rows: Transaction[];
  fee: Transaction | null;
  staleIds: string[];
};

export type TransactionWriteInput = {
  build: TransactionBuildInput;
  accounts: Account[];
  categories: Category[];
  rules: TransactionRule[];
  counterparty: Counterparty | null;
};

export function planTransactionWrite(input: TransactionWriteInput): TransactionWritePlan {
  const { build, accounts, categories, rules, counterparty } = input;
  const { form, existingTransactions, editingTransactionId } = build;

  const editedRow = editingTransactionId
    ? existingTransactions.find((entry) => entry.id === editingTransactionId)
    : undefined;
  const previousRowIds = new Set(
    editedRow ? transactionGroup(editedRow, existingTransactions).map((entry) => entry.id) : [],
  );
  const previousFee = existingTransactions.find(
    (entry) => entry.feeParentId && previousRowIds.has(entry.feeParentId),
  );

  const rows = buildRows({ build, accounts, categories, rules, counterparty });

  const feeParent = rows[0];
  const fee = buildFeeTransaction(
    feeParent,
    form.feeAmount,
    feesCategoryId(feeParent.userId),
    previousFee,
  );

  const writtenIds = new Set([...rows.map((row) => row.id), ...(fee ? [fee.id] : [])]);
  const staleIds = [...previousRowIds].filter((id) => !writtenIds.has(id));
  if (previousFee && !fee) {
    staleIds.push(previousFee.id);
  }

  return { rows, fee, staleIds };
}

function buildRows({
  build,
  accounts,
  categories,
  rules,
  counterparty,
}: TransactionWriteInput): Transaction[] {
  const { form } = build;

  if (form.type === "transfer") {
    const stamp = (row: Transaction): Transaction =>
      counterparty ? { ...row, counterpartyId: counterparty.id, payee: counterparty.name } : row;
    return buildTransferPair(build).map(stamp);
  }

  if (form.type === "debt_payment") {
    const loan = accounts.find((account) => account.id === form.destinationAccountId);
    if (!loan) {
      throw new Error("Choose which loan you are paying.");
    }
    return buildDebtPaymentTransactions(build, loan);
  }

  return [buildManualTransaction(build, rules, categories)];
}
