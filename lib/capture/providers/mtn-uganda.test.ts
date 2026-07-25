import { describe, expect, it } from "vitest";

import { parseMtnUgandaMessage } from "./mtn-uganda";

describe("parseMtnUgandaMessage", () => {
  it("skips pre-authorization requests", () => {
    expect(
      parseMtnUgandaMessage(
        "Y'ello. You have requested a withdrawal of UGX 50,000 from ROGERS SSEWAGUDDE . Dial *165# and select My Approvals to authorize the transaction.The total fee is  UGX 1,750 inclusive of 0.5 percent tax.Transaction ID 10173656344",
      ),
    ).toBeNull();
  });

  it("parses a withdrawal with fee + tax summed", () => {
    const r = parseMtnUgandaMessage(
      "You have withdrawn UGX 50,000 on 2026-06-27 09:35:56. Fee: UGX 1,500, Tax: UGX 250. New balance: UGX 50,363.01. Download MoMo App http://bit.ly/3KGlEJJ to get 500MBs",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(50000);
    expect(r?.feeAmount).toBe(1750);
    expect(r?.payee).toBe("Cash withdrawal");
    expect(r?.occurredOn).toBe("2026-06-27");
  });

  it("bounds the payee on an outgoing send", () => {
    const r = parseMtnUgandaMessage(
      "You have sent UGX 41410 to MILLY NAKIRANDA, 256785363402 on 2026-06-27 16:56:59, fee: 0. Reason: . New balance: 8953. ID :41669823701.",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(41410);
    expect(r?.feeAmount).toBeUndefined();
    expect(r?.payee).toBe("MILLY NAKIRANDA");
  });

  it("bounds the payee on an incoming receipt", () => {
    const r = parseMtnUgandaMessage(
      "You have received UGX 100000 from Centenary Bank . on 2026-06-27 09:25:41. fee:0. Reason: . New balance: UGX 102113.",
    );
    expect(r?.type).toBe("income");
    expect(r?.payee).toBe("Centenary Bank");
  });
});
