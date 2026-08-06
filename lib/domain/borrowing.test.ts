import { describe, expect, it } from "vitest";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import {
  BORROWING_POOL_ACCOUNT_ID,
  buildBorrowingPoolAccount,
  getBorrowingPortfolio,
  isInformalDebt,
} from "@/lib/domain/borrowing";
import type { Account, Transaction } from "@/lib/types";

const ASOF = new Date("2026-07-29T00:00:00.000Z");

const pool = buildBorrowingPoolAccount("user:default", "2026-01-01T00:00:00.000Z");

function dedicated(id: string, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    userId: "user:default",
    name,
    type: "debt",
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

/** The leg that lands on the debt side. Negative = borrowed, positive = repaid. */
function leg(
  amount: number,
  occurredOn: string,
  { accountId = BORROWING_POOL_ACCOUNT_ID, payee, expectedRepaymentDate }: LegOptions = {},
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

function forgiven(amount: number, occurredOn: string, payee?: string): Transaction {
  return {
    ...leg(amount, occurredOn, { payee }),
    id: `transaction:forgiven:${payee ?? "none"}:${occurredOn}`,
    type: "income",
    amount,
  };
}

describe("borrowing portfolio", () => {
  it("groups pooled borrowing by lender, case-insensitively", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [
        leg(-200_000, "2026-05-01", { payee: "Auntie Grace" }),
        leg(-100_000, "2026-06-01", { payee: "auntie grace " }),
        leg(50_000, "2026-07-01", { payee: "AUNTIE GRACE" }),
        leg(-80_000, "2026-06-10", { payee: "Musa" }),
      ],
      ASOF,
    );

    expect(portfolio.lenders).toHaveLength(2);

    const grace = portfolio.lenders.find((lender) => lender.lenderKey === "payee:auntie grace");
    expect(grace?.amountBorrowed).toBe(300_000);
    expect(grace?.amountRepaid).toBe(50_000);
    expect(grace?.outstanding).toBe(250_000);
    expect(grace?.borrowedOn).toBe("2026-05-01");
    expect(grace?.lastRepaymentOn).toBe("2026-07-01");
    expect(portfolio.totalOutstanding).toBe(330_000);
  });

  it("settles a lender who has been repaid in full", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [
        leg(-150_000, "2026-05-01", { payee: "Musa" }),
        leg(150_000, "2026-06-01", { payee: "Musa" }),
      ],
      ASOF,
    );

    expect(portfolio.lenders[0].status).toBe("settled");
    expect(portfolio.lenders[0].outstanding).toBe(0);
  });

  it("marks forgiven debt rather than counting it as a repayment", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [leg(-150_000, "2026-05-01", { payee: "Musa" }), forgiven(150_000, "2026-06-01", "Musa")],
      ASOF,
    );

    expect(portfolio.lenders[0].amountRepaid).toBe(0);
    expect(portfolio.lenders[0].amountForgiven).toBe(150_000);
    expect(portfolio.lenders[0].status).toBe("forgiven");
  });

  it("reports an overpayment instead of absorbing it", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [
        leg(-100_000, "2026-05-01", { payee: "Musa" }),
        leg(120_000, "2026-06-01", { payee: "Musa" }),
      ],
      ASOF,
    );

    expect(portfolio.lenders[0].outstanding).toBe(-20_000);
    expect(portfolio.lenders[0].status).toBe("overpaid");
  });

  it("flags an agreed date that has passed, and never invents one", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [
        leg(-100_000, "2026-05-01", { payee: "Grace", expectedRepaymentDate: "2026-06-30" }),
        leg(-50_000, "2026-05-02", { payee: "Musa" }),
      ],
      ASOF,
    );

    const grace = portfolio.lenders.find((lender) => lender.lenderName === "Grace");
    const musa = portfolio.lenders.find((lender) => lender.lenderName === "Musa");

    expect(grace?.isOverdue).toBe(true);
    expect(musa?.expectedRepaymentDate).toBeUndefined();
    expect(musa?.isOverdue).toBe(false);
    // Overdue sorts ahead of the larger balance.
    expect(portfolio.lenders[0].lenderName).toBe("Grace");
  });

  it("keeps a dedicated lender account on its own key and counts its opening balance", () => {
    const account = dedicated("account:musa", "Musa", {
      openingBalance: -400_000,
      balance: -400_000,
    });

    const portfolio = getBorrowingPortfolio([pool, account], [], ASOF);

    expect(portfolio.lenders).toHaveLength(1);
    expect(portfolio.lenders[0].lenderKey).toBe("account:account:musa");
    expect(portfolio.lenders[0].amountBorrowed).toBe(400_000);
    expect(portfolio.lenders[0].outstanding).toBe(400_000);
  });

  it("buckets pooled borrowing with no lender under one unnamed row", () => {
    const portfolio = getBorrowingPortfolio(
      [pool],
      [leg(-100_000, "2026-05-01"), leg(-50_000, "2026-06-01", { payee: "   " })],
      ASOF,
    );

    expect(portfolio.lenders).toHaveLength(1);
    expect(portfolio.lenders[0].lenderName).toBe("Unnamed lender");
    expect(portfolio.lenders[0].outstanding).toBe(150_000);
  });

  it("ignores archived accounts and accounts that are not informal debt", () => {
    const archived = dedicated("account:old", "Old loan", {
      isArchived: true,
      openingBalance: -100_000,
      balance: -100_000,
    });
    const formal = dedicated("account:sacco", "SACCO loan", {
      openingBalance: -900_000,
      balance: -900_000,
      debtInterestRate: 12,
      debtPrincipal: 900_000,
    });

    const portfolio = getBorrowingPortfolio([pool, archived, formal], [], ASOF);

    expect(portfolio.lenders).toHaveLength(0);
  });

  it("treats a loan with a stated rate, term, or principal as formal", () => {
    expect(isInformalDebt(pool)).toBe(true);
    expect(isInformalDebt(dedicated("account:a", "Aunt"))).toBe(true);
    expect(isInformalDebt(dedicated("account:b", "Bank", { debtInterestRate: 12 }))).toBe(false);
    expect(isInformalDebt(dedicated("account:c", "Bank", { debtTermMonths: 24 }))).toBe(false);
    expect(isInformalDebt(dedicated("account:d", "Bank", { debtPrincipal: 5_000 }))).toBe(false);
    expect(isInformalDebt({ ...dedicated("account:e", "Wallet"), type: "cash" })).toBe(false);
  });

  it("sums every lender's outstanding to the pool's reconciled balance", () => {
    const legs = [
      leg(-200_000, "2026-05-01", { payee: "Grace" }),
      leg(-80_000, "2026-05-02", { payee: "Musa" }),
      leg(60_000, "2026-06-01", { payee: "Grace" }),
      forgiven(20_000, "2026-06-02", "Musa"),
      leg(-40_000, "2026-06-03"),
    ];

    const [reconciled] = reconcileAccountBalances([pool], legs);
    const portfolio = getBorrowingPortfolio([reconciled], legs, ASOF);
    const summed = portfolio.lenders.reduce((total, lender) => total + lender.outstanding, 0);

    // A liability is stored negative, so the rows must add up to its mirror.
    expect(summed).toBe(-reconciled.balance);
  });
});
