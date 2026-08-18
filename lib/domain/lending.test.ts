import { describe, expect, it } from "vitest";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { buildCounterparty } from "@/lib/domain/counterparties";
import {
  lendingPoolAccountId,
  buildLendingPoolAccount,
  getLendingPortfolio,
} from "@/lib/domain/lending";
import type { Account, Transaction } from "@/lib/types";

const ASOF = new Date("2026-07-29T00:00:00.000Z");

const pool = buildLendingPoolAccount("user:default", "2026-01-01T00:00:00.000Z");

function dedicated(id: string, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    userId: "user:default",
    name,
    type: "receivable",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type LegOptions = {
  accountId?: string;
  payee?: string;
  expectedRepaymentDate?: string;
};

function leg(
  amount: number,
  occurredOn: string,
  { accountId = lendingPoolAccountId("user:default"), payee, expectedRepaymentDate }: LegOptions = {},
): Transaction {
  return {
    id: `transaction:${accountId}:${payee ?? "none"}:${occurredOn}:${amount}`,
    userId: "user:default",
    accountId,
    type: "transfer",
    amount,
    currency: "UGX",
    originalAmount: Math.abs(amount),
    occurredOn,
    categoryId: "category:transfers",
    reconciliationState: "posted",
    source: "manual",
    payee,
    expectedRepaymentDate,
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
  };
}

function lend(amount: number, occurredOn: string, options: LegOptions = {}) {
  return leg(Math.abs(amount), occurredOn, options);
}

function repay(amount: number, occurredOn: string, options: LegOptions = {}) {
  return leg(-Math.abs(amount), occurredOn, options);
}

function writeOff(amount: number, occurredOn: string, options: LegOptions = {}): Transaction {
  return {
    ...leg(Math.abs(amount), occurredOn, options),
    id: `transaction:writeoff:${options.payee ?? "none"}:${occurredOn}`,
    type: "expense",
    categoryId: "category:money-written-off",
  };
}

function borrowerNamed(
  portfolio: ReturnType<typeof getLendingPortfolio>,
  name: string,
) {
  return portfolio.parties.find((b) => b.partyName === name);
}

describe("the lending pool", () => {
  it("is a receivable account with a stable id", () => {
    expect(pool.id).toBe(lendingPoolAccountId("user:default"));
    expect(pool.type).toBe("receivable");
    expect(pool.openingBalance).toBe(0);
  });

  it("groups pooled loans by who borrowed, not by account", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      lend(200_000, "2026-06-05", { payee: "Musa" }),
    ];
    const portfolio = getLendingPortfolio([pool], transactions, ASOF);

    expect(portfolio.parties).toHaveLength(2);
    expect(borrowerNamed(portfolio, "Sarah")?.outstanding).toBe(500_000);
    expect(borrowerNamed(portfolio, "Musa")?.outstanding).toBe(200_000);
  });

  it("keeps every borrower's balance summing to the pool account balance", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      lend(200_000, "2026-06-05", { payee: "Musa" }),
      repay(120_000, "2026-07-02", { payee: "Sarah" }),
    ];
    const [reconciledPool] = reconcileAccountBalances([pool], transactions);
    const portfolio = getLendingPortfolio([reconciledPool], transactions, ASOF);
    const summed = portfolio.parties.reduce((total, b) => total + b.outstanding, 0);

    expect(summed).toBe(reconciledPool.balance);
    expect(summed).toBe(580_000);
  });

  it("treats repayments as reducing that borrower's balance, never as income", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      repay(200_000, "2026-07-10", { payee: "Sarah" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah).toMatchObject({
      amountAdvanced: 500_000,
      amountRepaid: 200_000,
      outstanding: 300_000,
      lastRepaymentOn: "2026-07-10",
      status: "outstanding",
    });
  });

  it("accumulates several loans to the same borrower", () => {
    const transactions = [
      lend(100_000, "2026-05-01", { payee: "Sarah" }),
      lend(50_000, "2026-06-01", { payee: "Sarah" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.amountAdvanced).toBe(150_000);
    expect(sarah?.advancedOn).toBe("2026-05-01");
  });

  it("matches borrowers case-insensitively but shows the name as first written", () => {
    const transactions = [
      lend(100_000, "2026-05-01", { payee: "Sarah" }),
      repay(40_000, "2026-06-01", { payee: "  sarah " }),
    ];
    const portfolio = getLendingPortfolio([pool], transactions, ASOF);

    expect(portfolio.parties).toHaveLength(1);
    expect(portfolio.parties[0].partyName).toBe("Sarah");
    expect(portfolio.parties[0].outstanding).toBe(60_000);
  });

  it("gathers pooled lending with no payee under one unnamed borrower", () => {
    const transactions = [lend(70_000, "2026-05-01")];
    const portfolio = getLendingPortfolio([pool], transactions, ASOF);

    expect(portfolio.parties).toHaveLength(1);
    expect(portfolio.parties[0].partyName).toBe("Unnamed borrower");
  });
});

describe("per-borrower accounts", () => {
  it("keys a dedicated account by the account, not the payee", () => {
    const sarah = dedicated("account:sarah", "Loan to Sarah");
    const transactions = [lend(500_000, "2026-06-01", { accountId: sarah.id })];
    const portfolio = getLendingPortfolio([sarah], transactions, ASOF);

    expect(portfolio.parties).toHaveLength(1);
    expect(portfolio.parties[0]).toMatchObject({
      partyName: "Loan to Sarah",
      accountId: "account:sarah",
      outstanding: 500_000,
    });
  });

  it("counts a dedicated account's opening balance as money already lent", () => {
    const brother = dedicated("account:brother", "Loan to brother", {
      openingBalance: 300_000,
    });
    const transactions = [lend(100_000, "2026-06-01", { accountId: brother.id })];
    const portfolio = getLendingPortfolio([brother], transactions, ASOF);

    expect(portfolio.parties[0].amountAdvanced).toBe(400_000);
    expect(portfolio.parties[0].outstanding).toBe(400_000);
  });

  it("reports pooled and dedicated borrowers side by side", () => {
    const sarah = dedicated("account:sarah", "Loan to Sarah");
    const transactions = [
      lend(500_000, "2026-06-01", { accountId: sarah.id }),
      lend(200_000, "2026-06-05", { payee: "Musa" }),
    ];
    const portfolio = getLendingPortfolio([pool, sarah], transactions, ASOF);

    expect(portfolio.parties).toHaveLength(2);
    expect(portfolio.totalOutstanding).toBe(700_000);
  });

  it("leaves the pool out of the list when it holds nothing", () => {
    const sarah = dedicated("account:sarah", "Loan to Sarah");
    const transactions = [lend(500_000, "2026-06-01", { accountId: sarah.id })];
    const portfolio = getLendingPortfolio([pool, sarah], transactions, ASOF);

    expect(portfolio.parties.map((b) => b.partyName)).toEqual(["Loan to Sarah"]);
  });
});

describe("status and overdue", () => {
  it("marks a fully repaid borrower as settled", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      repay(500_000, "2026-07-10", { payee: "Sarah" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.outstanding).toBe(0);
    expect(sarah?.status).toBe("settled");
  });

  it("reports an overpayment rather than hiding it behind an absolute value", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      repay(620_000, "2026-07-10", { payee: "Sarah" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.outstanding).toBe(-120_000);
    expect(sarah?.status).toBe("overpaid");
  });

  it("marks a borrower cleared by a write-off as written off", () => {
    const transactions = [
      lend(500_000, "2026-02-01", { payee: "Cousin" }),
      writeOff(500_000, "2026-07-01", { payee: "Cousin" }),
    ];
    const cousin = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Cousin");

    expect(cousin).toMatchObject({
      amountCancelled: 500_000,
      outstanding: 0,
      status: "cancelled",
    });
  });

  it("keeps a partially written-off borrower outstanding", () => {
    const transactions = [
      lend(500_000, "2026-02-01", { payee: "Cousin" }),
      writeOff(200_000, "2026-07-01", { payee: "Cousin" }),
    ];
    const cousin = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Cousin");

    expect(cousin?.outstanding).toBe(300_000);
    expect(cousin?.status).toBe("outstanding");
  });

  it("reads the repayment date off the loan, so pooled loans can be overdue", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah", expectedRepaymentDate: "2026-07-01" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.expectedRepaymentDate).toBe("2026-07-01");
    expect(sarah?.isOverdue).toBe(true);
  });

  it("does not flag a loan whose repayment date has not arrived", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah", expectedRepaymentDate: "2026-12-01" }),
    ];

    expect(
      borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah")?.isOverdue,
    ).toBe(false);
  });

  it("never infers a repayment date when none was agreed", () => {
    const transactions = [lend(500_000, "2020-01-01", { payee: "Sarah" })];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.expectedRepaymentDate).toBeUndefined();
    expect(sarah?.isOverdue).toBe(false);
  });

  it("surfaces the soonest date when a borrower has several dated loans", () => {
    const transactions = [
      lend(100_000, "2026-05-01", { payee: "Sarah", expectedRepaymentDate: "2026-11-01" }),
      lend(100_000, "2026-05-02", { payee: "Sarah", expectedRepaymentDate: "2026-09-01" }),
    ];

    expect(
      borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah")
        ?.expectedRepaymentDate,
    ).toBe("2026-09-01");
  });

  it("does not flag a settled borrower as overdue", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah", expectedRepaymentDate: "2026-07-01" }),
      repay(500_000, "2026-06-20", { payee: "Sarah" }),
    ];
    const sarah = borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah");

    expect(sarah?.status).toBe("settled");
    expect(sarah?.isOverdue).toBe(false);
  });

  it("measures days since activity against the supplied clock", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      repay(100_000, "2026-07-19", { payee: "Sarah" }),
    ];

    expect(
      borrowerNamed(getLendingPortfolio([pool], transactions, ASOF), "Sarah")
        ?.daysSinceLastActivity,
    ).toBe(10);
  });
});

describe("portfolio totals and ordering", () => {
  it("returns empty totals when nothing has been lent", () => {
    expect(getLendingPortfolio([pool], [], ASOF)).toEqual({
      totalAdvanced: 0,
      totalRepaid: 0,
      totalCancelled: 0,
      totalOutstanding: 0,
      parties: [],
    });
  });

  it("ignores accounts that are not receivables", () => {
    const bank = dedicated("account:bank", "Bank", { type: "bank", balance: 900_000 });
    const transactions = [lend(900_000, "2026-06-01", { accountId: bank.id, payee: "Sarah" })];

    expect(getLendingPortfolio([bank], transactions, ASOF).parties).toEqual([]);
  });

  it("totals across borrowers", () => {
    const transactions = [
      lend(500_000, "2026-06-01", { payee: "Sarah" }),
      repay(200_000, "2026-07-10", { payee: "Sarah" }),
      lend(300_000, "2026-02-01", { payee: "Cousin" }),
      writeOff(300_000, "2026-07-01", { payee: "Cousin" }),
    ];

    expect(getLendingPortfolio([pool], transactions, ASOF)).toMatchObject({
      totalAdvanced: 800_000,
      totalRepaid: 200_000,
      totalCancelled: 300_000,
      totalOutstanding: 300_000,
    });
  });

  it("sorts overdue borrowers ahead of larger balances", () => {
    const transactions = [
      lend(900_000, "2026-06-01", { payee: "Big" }),
      lend(100_000, "2026-06-01", { payee: "Late", expectedRepaymentDate: "2026-07-01" }),
    ];
    const portfolio = getLendingPortfolio([pool], transactions, ASOF);

    expect(portfolio.parties.map((b) => b.partyName)).toEqual(["Late", "Big"]);
  });

  it("sorts by largest balance when nobody is overdue", () => {
    const transactions = [
      lend(100_000, "2026-06-01", { payee: "Small" }),
      lend(900_000, "2026-06-01", { payee: "Big" }),
    ];
    const portfolio = getLendingPortfolio([pool], transactions, ASOF);

    expect(portfolio.parties.map((b) => b.partyName)).toEqual(["Big", "Small"]);
  });

  it("excludes archived receivable accounts", () => {
    const old = dedicated("account:old", "Old loan", { isArchived: true });
    const transactions = [lend(500_000, "2026-01-01", { accountId: old.id })];

    expect(getLendingPortfolio([old], transactions, ASOF).parties).toEqual([]);
  });

  it("groups on the counterparty, so a typo in the payee cannot split a borrower", () => {
    const sarah = buildCounterparty({
      id: "counterparty:sarah",
      userId: "user:default",
      name: "Sarah",
      kind: "borrower",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const transactions = [
      { ...lend(200_000, "2026-05-01", { payee: "Sarah" }), counterpartyId: sarah.id },
      { ...lend(100_000, "2026-06-01", { payee: "Sarra" }), counterpartyId: sarah.id },
    ];

    const portfolio = getLendingPortfolio([pool], transactions, ASOF, [sarah]);

    expect(portfolio.parties).toHaveLength(1);
    expect(portfolio.parties[0].partyName).toBe("Sarah");
    expect(portfolio.parties[0].counterpartyId).toBe(sarah.id);
    expect(portfolio.parties[0].outstanding).toBe(300_000);
  });

  it("falls back to the payee for rows written before counterparties existed", () => {
    const transactions = [lend(200_000, "2026-05-01", { payee: "Musa" })];

    const portfolio = getLendingPortfolio([pool], transactions, ASOF, []);

    expect(portfolio.parties[0].partyName).toBe("Musa");
    expect(portfolio.parties[0].counterpartyId).toBeUndefined();
  });
});
