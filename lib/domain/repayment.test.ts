import { describe, expect, it } from "vitest";

import { lastLoanPaymentOn } from "@/lib/domain/debt-payment";
import type { PartyLedgerEntry } from "@/lib/domain/party-ledger";
import { previewLoanRepayment, previewPartyRepayment } from "@/lib/domain/repayment";
import type { Account, Transaction } from "@/lib/types";

function loanAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "debt:sacco",
    userId: "user:1",
    name: "SACCO loan",
    type: "debt",
    openingBalance: -1_000_000,
    balance: -1_000_000,
    debtPrincipal: 1_000_000,
    debtInterestModel: "reducing_balance",
    debtStartDate: "2026-06-01",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function payment(accountId: string, occurredOn: string): Transaction {
  return {
    id: `t:${accountId}:${occurredOn}`,
    userId: "user:1",
    accountId,
    type: "transfer",
    amount: 100_000,
    currency: "UGX",
    originalAmount: 100_000,
    occurredOn,
    categoryId: "c:1",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function party(overrides: Partial<PartyLedgerEntry> = {}): PartyLedgerEntry {
  return {
    partyKey: "p:1",
    partyName: "Auntie Grace",
    counterpartyId: "cp:1",
    amountAdvanced: 500_000,
    amountRepaid: 0,
    amountCancelled: 0,
    outstanding: 500_000,
    advancedOn: "2026-08-04",
    lastRepaymentOn: null,
    isOverdue: false,
    status: "outstanding",
    daysSinceLastActivity: 10,
    ...overrides,
  };
}

describe("lastLoanPaymentOn", () => {
  it("takes the latest payment against that loan", () => {
    const dates = [
      payment("debt:sacco", "2026-06-15"),
      payment("debt:other", "2026-08-01"),
      payment("debt:sacco", "2026-07-20"),
    ];

    expect(lastLoanPaymentOn("debt:sacco", dates)).toBe("2026-07-20");
  });

  it("reads nothing when the loan has never been paid", () => {
    expect(lastLoanPaymentOn("debt:sacco", [])).toBeNull();
  });
});

describe("previewLoanRepayment", () => {
  it("reads the outstanding balance off the loan", () => {
    const preview = previewLoanRepayment({
      loan: loanAccount({ debtInterestRate: undefined }),
      transactions: [],
      paymentAmount: 0,
      occurredOn: "2026-08-18",
    });

    expect(preview.outstanding).toBe(1_000_000);
    expect(preview.payoffAmount).toBe(1_000_000);
    expect(preview.split).toBeNull();
    expect(preview.remaining).toBeNull();
  });

  it("puts the interest owed on top of the payoff figure", () => {
    const preview = previewLoanRepayment({
      loan: loanAccount({ debtInterestRate: 12 }),
      transactions: [],
      paymentAmount: 0,
      occurredOn: "2026-07-01",
    });

    expect(preview.payoffAmount).toBeGreaterThan(preview.outstanding);
  });

  it("splits a part payment and says what is left", () => {
    const preview = previewLoanRepayment({
      loan: loanAccount({ debtInterestRate: undefined }),
      transactions: [],
      paymentAmount: 300_000,
      occurredOn: "2026-08-18",
    });

    expect(preview.split).toMatchObject({ interest: 0, principal: 300_000 });
    expect(preview.remaining).toBe(700_000);
    expect(preview.clears).toBe(false);
  });

  it("calls it cleared when the payment covers the balance", () => {
    const preview = previewLoanRepayment({
      loan: loanAccount({ debtInterestRate: undefined }),
      transactions: [],
      paymentAmount: 1_000_000,
      occurredOn: "2026-08-18",
    });

    expect(preview.clears).toBe(true);
    expect(preview.remaining).toBe(0);
  });

  it("accrues from the last payment rather than the start date", () => {
    const loan = loanAccount({ debtInterestRate: 12 });
    const fromStart = previewLoanRepayment({
      loan,
      transactions: [],
      paymentAmount: 0,
      occurredOn: "2026-08-18",
    });
    const fromLastPayment = previewLoanRepayment({
      loan,
      transactions: [payment(loan.id, "2026-08-01")],
      paymentAmount: 0,
      occurredOn: "2026-08-18",
    });

    expect(fromLastPayment.payoffAmount).toBeLessThan(fromStart.payoffAmount);
  });
});

describe("previewPartyRepayment", () => {
  it("says what is left after a part payment", () => {
    const preview = previewPartyRepayment({ party: party(), paymentAmount: 200_000 });

    expect(preview).toMatchObject({
      outstanding: 500_000,
      payoffAmount: 500_000,
      remaining: 300_000,
      clears: false,
      split: null,
    });
  });

  it("clears at exactly the outstanding amount, and does not go negative beyond it", () => {
    expect(previewPartyRepayment({ party: party(), paymentAmount: 500_000 })).toMatchObject({
      remaining: 0,
      clears: true,
    });
    expect(previewPartyRepayment({ party: party(), paymentAmount: 800_000 })).toMatchObject({
      remaining: 0,
      clears: true,
    });
  });

  it("holds back the verdict until an amount is entered", () => {
    const preview = previewPartyRepayment({ party: party(), paymentAmount: 0 });

    expect(preview.remaining).toBeNull();
    expect(preview.clears).toBe(false);
  });

  it("reads a settled party as nothing outstanding", () => {
    const preview = previewPartyRepayment({
      party: party({ outstanding: 0, status: "settled" }),
      paymentAmount: 0,
    });

    expect(preview.outstanding).toBe(0);
    expect(preview.payoffAmount).toBe(0);
  });
});
