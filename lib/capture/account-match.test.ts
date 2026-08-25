import { describe, expect, it } from "vitest";

import { chooseCaptureAccount } from "./account-match";
import type { Account } from "@/lib/types";

function account(id: string, name: string, institutionName?: string): Account {
  return {
    id,
    userId: "user:1",
    name,
    type: "mobile_money",
    institutionName,
    openingBalance: 0,
    balance: 0,
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
  } as Account;
}

const accounts = [
  account("account:cash", "Cash"),
  account("account:momo", "MTN MoMo"),
  account("account:airtel", "Airtel Money"),
  account("account:bank", "Savings", "Centenary Bank"),
];

describe("chooseCaptureAccount", () => {
  /* The sender is what says which account the money moved on. Taking the first
     account instead put every provider's money on one of them. */
  it("takes the account the sender names", () => {
    expect(chooseCaptureAccount({ accounts, sender: "AirtelMoney" })).toEqual({
      accountId: "account:airtel",
      matched: true,
    });
  });

  /* Real senders are not spelled the way accounts are named. Nothing reads
     "MTN MoMo" out of "MTNMobMoney", which is why the mapping exists. */
  it("settles it from the mapping, whatever the sender is spelled like", () => {
    expect(
      chooseCaptureAccount({
        accounts,
        sender: "MTNMobMoney",
        mappedAccountId: "account:momo",
      }),
    ).toEqual({ accountId: "account:momo", matched: true });
  });

  it("reads the names when the sender has no mapping yet", () => {
    expect(chooseCaptureAccount({ accounts, sender: "MTNMobMoney" })).toEqual({
      accountId: "account:cash",
      matched: false,
    });
  });

  it("ignores a mapping pointing at an account that is gone", () => {
    expect(
      chooseCaptureAccount({
        accounts,
        sender: "AirtelMoney",
        mappedAccountId: "account:deleted",
      }),
    ).toEqual({ accountId: "account:airtel", matched: true });
  });

  it("reads the institution when the account is named something else", () => {
    expect(chooseCaptureAccount({ accounts, sender: "Centenary" })).toEqual({
      accountId: "account:bank",
      matched: true,
    });
  });

  it("falls back to the message when the sender says nothing", () => {
    expect(
      chooseCaptureAccount({
        accounts,
        sender: "12345",
        text: "Confirmed. UGX 1,000 sent on Airtel Money.",
      }),
    ).toEqual({ accountId: "account:airtel", matched: true });
  });

  /* A capture with no account cannot be reviewed, so one is still chosen. The
     caller is told it was a fallback so it never reads as a decision. */
  it("says when it fell back rather than read an account", () => {
    expect(chooseCaptureAccount({ accounts, sender: "Stanbic" })).toEqual({
      accountId: "account:cash",
      matched: false,
    });
    expect(chooseCaptureAccount({ accounts })).toEqual({
      accountId: "account:cash",
      matched: false,
    });
  });

  it("has nothing to choose when there are no accounts", () => {
    expect(chooseCaptureAccount({ accounts: [], sender: "MTN MoMo" })).toBeNull();
  });
});
