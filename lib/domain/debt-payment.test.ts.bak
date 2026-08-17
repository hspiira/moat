import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { splitDebtPayment } from "@/lib/domain/debt-payment";
import type { Account } from "@/lib/types";

function debtAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "debt:sacco",
    userId: "user:default",
    name: "SACCO loan",
    type: "debt",
    openingBalance: -1_000_000,
    balance: -1_000_000,
    debtPrincipal: 1_000_000,
    debtInterestModel: "reducing_balance",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("splitDebtPayment", () => {
  it("ignores accounts that are not debts", () => {
    const wallet = debtAccount({ type: "cash", balance: 500_000 });

    expect(
      splitDebtPayment({
        account: wallet,
        paymentAmount: 100_000,
        occurredOn: "2026-07-01",
        previousPaymentOn: "2026-06-01",
      }),
    ).toBeNull();
  });

  it("treats an interest-free loan as pure principal", () => {
    // The family-loan case: no rate set at all.
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: undefined }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split).toMatchObject({ interest: 0, principal: 100_000, overpayment: 0 });
  });

  it("treats an explicit zero rate as pure principal", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 0 }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.interest).toBe(0);
    expect(split?.principal).toBe(100_000);
  });

  it("accrues interest on the outstanding balance for a reducing-balance loan", () => {
    // 1,000,000 at 12% for 30 days: 1,000,000 * 0.12 * 30/365 = 9,863.01
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 12, balance: -1_000_000 }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.interest).toBe(9_863);
    expect(split?.principal).toBe(90_137);
  });

  it("accrues a flat-rate loan on the original principal, not the balance", () => {
    // Flat: 1,000,000 principal at 12% for 30 days, even though only
    // 400,000 is still owed.
    const split = splitDebtPayment({
      account: debtAccount({
        debtInterestRate: 12,
        debtInterestModel: "flat",
        debtPrincipal: 1_000_000,
        balance: -400_000,
      }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.interest).toBe(9_863);
  });

  it("charges no interest when no time has passed since the last payment", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 12 }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-07-01",
    });

    expect(split?.interest).toBe(0);
    expect(split?.principal).toBe(100_000);
  });

  it("accrues from the loan start date when no payment has been made yet", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 12, debtStartDate: "2026-06-01" }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: null,
    });

    expect(split?.interest).toBe(9_863);
  });

  it("charges no interest when there is no start date and no prior payment", () => {
    // Nothing to measure elapsed time against; inventing a period would
    // invent a cost the user never agreed to.
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 12, debtStartDate: undefined }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: null,
    });

    expect(split?.interest).toBe(0);
  });

  it("puts the whole payment to interest when it cannot cover what accrued", () => {
    // A year of 24% on 1,000,000 accrues ~240,000; a 50,000 payment does not
    // touch principal, and the debt grows.
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 24, balance: -1_000_000 }),
      paymentAmount: 50_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2025-07-01",
    });

    expect(split?.interest).toBe(50_000);
    expect(split?.principal).toBe(0);
    expect(split?.coversInterest).toBe(false);
    expect(split?.accruedInterest).toBeGreaterThan(50_000);
  });

  it("flags a payment that does cover its interest", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 12 }),
      paymentAmount: 100_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.coversInterest).toBe(true);
  });

  it("caps principal at what is still owed and reports the rest as overpayment", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 0, balance: -30_000 }),
      paymentAmount: 50_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.principal).toBe(30_000);
    expect(split?.overpayment).toBe(20_000);
  });

  it("never reports a negative principal on an already-cleared loan", () => {
    const split = splitDebtPayment({
      account: debtAccount({ debtInterestRate: 0, balance: 0 }),
      paymentAmount: 50_000,
      occurredOn: "2026-07-01",
      previousPaymentOn: "2026-06-01",
    });

    expect(split?.principal).toBe(0);
    expect(split?.overpayment).toBe(50_000);
  });

  it("splits a payment into parts that add back to exactly the payment", () => {
    // Rounding interest to whole UGX must not lose or invent money, or the
    // three transactions written from a split would not reconcile.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 730 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        (paymentAmount, rate, elapsedDays, owed) => {
          const start = new Date("2026-01-01T00:00:00.000Z");
          const paidOn = new Date(start.getTime() + elapsedDays * 86_400_000);

          const split = splitDebtPayment({
            account: debtAccount({ debtInterestRate: rate, balance: -owed }),
            paymentAmount,
            occurredOn: paidOn.toISOString().slice(0, 10),
            previousPaymentOn: "2026-01-01",
          });

          expect(split!.interest + split!.principal + split!.overpayment).toBe(paymentAmount);
          expect(split!.interest).toBeGreaterThanOrEqual(0);
          expect(split!.principal).toBeGreaterThanOrEqual(0);
          expect(split!.overpayment).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});
