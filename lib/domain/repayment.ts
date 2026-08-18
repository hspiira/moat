import {
  accruedLoanInterest,
  lastLoanPaymentOn,
  splitDebtPayment,
  type DebtPaymentSplit,
} from "@/lib/domain/debt-payment";
import type { PartyLedgerEntry } from "@/lib/domain/party-ledger";
import type { Account, Transaction } from "@/lib/types";

export type RepaymentPreview = {
  outstanding: number;
  payoffAmount: number;
  remaining: number | null;
  clears: boolean;
  split: DebtPaymentSplit | null;
};

export function previewLoanRepayment(params: {
  loan: Account;
  transactions: Transaction[];
  paymentAmount: number;
  occurredOn: string;
}): RepaymentPreview {
  const { loan, transactions, paymentAmount, occurredOn } = params;

  const previousPaymentOn = lastLoanPaymentOn(loan.id, transactions);
  const outstanding = Math.max(0, -loan.balance);
  const interest = accruedLoanInterest({ account: loan, occurredOn, previousPaymentOn });
  const split =
    paymentAmount > 0
      ? splitDebtPayment({ account: loan, paymentAmount, occurredOn, previousPaymentOn })
      : null;
  const remaining = split ? Math.max(0, outstanding - split.principal) : null;

  return {
    outstanding,
    payoffAmount: outstanding + interest,
    remaining,
    clears: remaining === 0,
    split,
  };
}

export function previewPartyRepayment(params: {
  party: PartyLedgerEntry;
  paymentAmount: number;
}): RepaymentPreview {
  const outstanding = Math.max(0, params.party.outstanding);
  const remaining =
    params.paymentAmount > 0 ? Math.max(0, outstanding - params.paymentAmount) : null;

  return {
    outstanding,
    payoffAmount: outstanding,
    remaining,
    clears: remaining === 0,
    split: null,
  };
}
