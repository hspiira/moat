import { describe, expect, it } from "vitest";

import {
  loanCaption,
  loanOptions,
  partyCaption,
} from "@/components/transactions/transaction-form-model";
import type { Account } from "@/lib/types";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account:loan",
    userId: "user:default",
    name: "Bank loan",
    type: "debt",
    openingBalance: 0,
    balance: -400_000,
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loanOptions", () => {
  it("offers only what you owe on", () => {
    const options = loanOptions([account(), account({ id: "account:cash", type: "cash" })]);

    expect(options).toHaveLength(1);
    expect(options[0].value).toBe("account:loan");
  });

  it("says what is left, as a positive figure", () => {
    expect(loanOptions([account({ balance: -400_000 })])[0].label).toContain("400,000 left");
  });

  it("says nothing about what is left once it is cleared", () => {
    expect(loanOptions([account({ balance: 0 })])[0].label).toBe("Bank loan");
  });

  it("does not report a credit balance as an amount owed", () => {
    expect(loanOptions([account({ balance: 50_000 })])[0].label).toBe("Bank loan");
  });
});

describe("loanCaption", () => {
  it("says when the loan started", () => {
    expect(loanCaption(account({ debtStartDate: "2026-03-01" }))).toContain("since");
  });

  it("says nothing when no start date is known", () => {
    expect(loanCaption(account())).toBeNull();
    expect(loanCaption(undefined)).toBeNull();
  });
});

describe("partyCaption", () => {
  it("says when the money went out", () => {
    expect(partyCaption("2026-03-01")).toContain("since");
  });

  it("says nothing without a date", () => {
    expect(partyCaption(null)).toBeNull();
  });
});
