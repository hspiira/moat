import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { todayIso } from "@/lib/today";
import type { TransferDirection } from "@/lib/domain/transfer-counterparty";
import type { Account } from "@/lib/types";

import type { TransactionFormState } from "./transaction-form";

export const NO_PROJECT = "none";

export const sectionTitles: Record<TransferDirection, string> = {
  lend: "Lending",
  collect: "Repayment",
  borrow: "Borrowing",
  repay: "Repayment",
};

export const outstandingLabels: Record<TransferDirection, string> = {
  lend: "Already owes you",
  collect: "Owes you",
  borrow: "You already owe",
  repay: "You owe",
};

export const settlingDirections = new Set<TransferDirection>(["collect", "repay"]);

export function loanOptions(accounts: Account[]) {
  return accounts
    .filter((account) => account.type === "debt")
    .map((account) => {
      const outstanding = Math.max(0, -account.balance);
      return {
        value: account.id,
        label:
          outstanding > 0
            ? `${account.name} · ${formatMoney(outstanding, "UGX")} left`
            : account.name,
      };
    });
}

export function loanCaption(loan: Account | undefined): string | null {
  return loan?.debtStartDate ? `since ${formatDate(loan.debtStartDate)}` : null;
}

export function partyCaption(advancedOn: string | null): string | null {
  return advancedOn ? `since ${formatDate(advancedOn)}` : null;
}

export function createDefaultTransactionForm(): TransactionFormState {
  return { ...defaultTransactionFormShape, occurredOn: todayIso() };
}

const defaultTransactionFormShape: TransactionFormState = {
  type: "expense",
  accountId: "",
  destinationAccountId: "",
  categoryId: "",
  currency: "UGX",
  payee: "",
  counterpartyId: "",
  counterpartyName: "",
  amount: "",
  fxRateToUgx: "",
  feeAmount: "",
  occurredOn: "",
  expectedRepaymentDate: "",
  projectId: "",
  note: "",
};

