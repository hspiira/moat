import { describe, expect, it } from "vitest";

import { parseStatedBalance } from "@/lib/capture/normalizers";
import { pendingReviewGap, type BalanceGapSubject } from "@/lib/domain/balance-gap";
import type { Transaction } from "@/lib/types";

/**
 * Real Centenary Uganda alerts. Centenary never prints the fee it charges, but
 * it does print the resulting balance — so the difference between consecutive
 * stated balances and the transaction amounts between them is the hidden fee.
 *
 * Verified by hand against the source messages:
 *   675,894 expected vs 673,019 stated -> 2,875
 *   607,019 expected vs 604,144 stated -> 2,875
 *    19,144 expected vs  12,244 stated -> 6,900
 */
const MESSAGES = [
  "CENTENARY: Dear HENRY, a trxn of -455,000 on your A/C **767 on 26-07-2026 at 15:58. Bal:875,894 (Mobile Scool Fees payment /Ebanking). Call 0800200555",
  "CENTENARY: Dear HENRY, a trxn of -200,000 on your A/C **767 on 27-07-2026 at 15:02. Bal:673,019 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
  "CENTENARY: Dear HENRY, a trxn of -66,000 on your A/C **767 on 29-07-2026 at 21:21. Bal:604,144 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
  "CENTENARY: Dear HENRY, a trxn of -585,000 on your A/C **767 on 29-07-2026 at 21:23. Bal:12,244 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
];

const ACCOUNT_ID = "account:centenary";

function expense(
  id: string,
  amount: number,
  occurredOn: string,
  statedBalance: number,
): Transaction {
  return {
    id,
    userId: "user:1",
    accountId: ACCOUNT_ID,
    type: "expense",
    amount,
    currency: "UGX",
    originalAmount: amount,
    occurredOn,
    categoryId: "category:1",
    reconciliationState: "reviewed",
    source: "pasted_text",
    statedBalance,
    createdAt: occurredOn,
    updatedAt: occurredOn,
  };
}

describe("Centenary hidden-fee recovery", () => {
  it("reads the stated balance out of Centenary's Bal: format", () => {
    expect(MESSAGES.map(parseStatedBalance)).toEqual([875894, 673019, 604144, 12244]);
  });

  it.each([
    { label: "27-07 transfer", amount: 200000, on: "2026-07-27", stated: 673019, fee: 2875 },
    { label: "29-07 transfer", amount: 66000, on: "2026-07-29", stated: 604144, fee: 2875 },
  ])("recovers the undisclosed fee on the $label", ({ amount, on, stated, fee }) => {
    // The prior checkpoint is already in the ledger; the new message is still
    // an unapproved candidate, which is the shape the paste module holds.
    const ledger = [expense("txn:prior", 455000, "2026-07-26", 875894)];
    const priorFor29th = expense("txn:27th", 200000, "2026-07-27", 673019);

    const candidate: BalanceGapSubject = {
      id: "candidate:pending",
      accountId: ACCOUNT_ID,
      type: "expense",
      normalizedAmount: amount,
      currency: "UGX",
      originalAmount: amount,
      occurredOn: on,
      categoryId: "category:1",
      source: "pasted_text",
      statedBalance: stated,
    };

    const gap = pendingReviewGap(
      candidate,
      on === "2026-07-29" ? [...ledger, priorFor29th] : ledger,
    );

    expect(gap).not.toBeNull();
    // Negative: money left the account without being recorded.
    expect(gap?.gap).toBe(-fee);
    expect(gap?.statedBalance).toBe(stated);
  });

  it("returns no gap when the balance is fully explained", () => {
    const ledger = [expense("txn:prior", 455000, "2026-07-26", 875894)];

    const candidate: BalanceGapSubject = {
      id: "candidate:clean",
      accountId: ACCOUNT_ID,
      type: "expense",
      normalizedAmount: 200000,
      currency: "UGX",
      originalAmount: 200000,
      occurredOn: "2026-07-27",
      categoryId: "category:1",
      source: "pasted_text",
      // 875,894 - 200,000 with no fee deducted.
      statedBalance: 675894,
    };

    expect(pendingReviewGap(candidate, ledger)).toBeNull();
  });
});
