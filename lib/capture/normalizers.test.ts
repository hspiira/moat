import { describe, expect, it } from "vitest";

import { inferCapturePayee, inferCaptureType, parseStatedBalance } from "./normalizers";

describe("parseStatedBalance", () => {
  it("reads the balance MTN/Airtel/Centenary print", () => {
    expect(parseStatedBalance("New balance: 8953. ID :41669823701.")).toBe(8953);
    expect(parseStatedBalance("New balance: UGX 102113.")).toBe(102113);
    expect(parseStatedBalance("Bal UGX 37. 23-July-2026 17:09")).toBe(37);
    expect(parseStatedBalance("Balance UGX 10,037. Trans ID:1")).toBe(10037);
    expect(parseStatedBalance("Bal:1,688,944 (Funds Transfer). Call")).toBe(1688944);
  });

  it("returns undefined when no balance is stated (Absa)", () => {
    expect(
      parseStatedBalance("Absa confirms an ATM cash Withdrawal of UGX 100,000.00 on Acc. ending ***15"),
    ).toBeUndefined();
  });
});

describe("inferCapturePayee", () => {
  it("stops at the phone number rather than swallowing the tail", () => {
    expect(
      inferCapturePayee(
        "SENT.TID 153524294394. UGX 7,000 to STEVEN MUWANGUZI  0705366804. Fee UGX 500. Bal UGX 114,465. Date 08-August-2026 21:17.",
      ),
    ).toBe("STEVEN MUWANGUZI  0705366804");
  });

  it("drops a trailing fee and balance", () => {
    expect(
      inferCapturePayee(
        "SENT.TID 152542550739. UGX 500 to MARIAM NANFUKA  0750407189. Fee UGX 100. Bal UGX 63,732. Date 26-July-2026 14:37.",
      ),
    ).toBe("MARIAM NANFUKA  0750407189");
  });

  it("returns nothing when no party is named", () => {
    expect(inferCapturePayee("Your balance is UGX 4,243")).toBe("");
  });
});

describe("captured savings", () => {
  it("reads moving money to your own savings as a transfer", () => {
    // This used to read as spending because capture could not express a
    // destination. It can now, and the destination is asked for on review.
    expect(inferCaptureType("Moved UGX 50,000 to savings")).toBe("transfer");
  });

  it("still reads a contribution as spending, since it names no account", () => {
    expect(inferCaptureType("SACCO contribution UGX 50,000")).toBe("expense");
  });
});

describe("transfers between your own accounts", () => {
  it("reads the wording banks and wallets use", () => {
    for (const text of [
      "Transferred UGX 200,000 to your bank account on 12-08-2026",
      "You have moved USh 50,000 to your own wallet",
      "Bank transfer of UGX 1,000,000 completed",
      "Withdrawal to bank of UGX 300,000",
    ]) {
      expect(inferCaptureType(text), text).toBe("transfer");
    }
  });

  it("wins over income when a message says both", () => {
    // The receiving half of a transfer says "received", which would otherwise
    // book the same movement as new money coming in.
    expect(
      inferCaptureType("Received UGX 200,000 transferred from your own bank account"),
    ).toBe("transfer");
  });

  it("leaves an ordinary payment to someone else alone", () => {
    expect(inferCaptureType("Paid USh 45,000 to Grocery store")).toBe("expense");
    expect(inferCaptureType("Received UGX 500,000 from Employer Ltd")).toBe("income");
  });

  it("does not call a loan repayment a transfer", () => {
    expect(inferCaptureType("Loan repayment of UGX 80,000 received")).toBe("debt_payment");
  });
});
