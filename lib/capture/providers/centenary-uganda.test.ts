import { describe, expect, it } from "vitest";

import { parseCentenaryUgandaMessage } from "./centenary-uganda";

describe("parseCentenaryUgandaMessage", () => {
  it("parses a debit (negative) as an expense", () => {
    const r = parseCentenaryUgandaMessage(
      "CENTENARY: Dear HENRY, a trxn of -36,000 on your A/C **767 on 06-07-2026 at 16:11. Bal:5,829 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(36000);
    expect(r?.payee).toBe("Funds Transfer (Mobile) /Ebanking");
    expect(r?.occurredOn).toBe("2026-07-06");
  });

  it("parses a credit (positive) as income with a comma-safe amount", () => {
    const r = parseCentenaryUgandaMessage(
      "CENTENARY: Dear HENRY, a trxn of 1,790,590 on your A/C **767 on 24-07-2026 at 13:46. Bal:1,791,819 ( EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office). Call",
    );
    expect(r?.type).toBe("income");
    expect(r?.originalAmount).toBe(1790590);
    expect(r?.payee).toBe("EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office");
    expect(r?.occurredOn).toBe("2026-07-24");
  });
});
