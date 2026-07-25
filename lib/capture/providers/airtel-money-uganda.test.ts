import { describe, expect, it } from "vitest";

import { parseAirtelMoneyUgandaMessage } from "./airtel-money-uganda";

describe("parseAirtelMoneyUgandaMessage", () => {
  it("parses a PAID.TID expense", () => {
    const r = parseAirtelMoneyUgandaMessage(
      "PAID.TID 152340835065. UGX 1,000 to Data bundle  Mobile App Charge UGX 0. Bal UGX 37. 23-July-2026 17:09",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(1000);
    expect(r?.feeAmount).toBeUndefined();
    expect(r?.payee).toBe("Data bundle");
  });

  it("parses a cash deposit as income", () => {
    const r = parseAirtelMoneyUgandaMessage(
      "Cash deposit of UGX 10,000 from SARAH. Balance UGX 10,037. Trans ID:152346928830. Date 23-July-2026 18:31.",
    );
    expect(r?.type).toBe("income");
    expect(r?.originalAmount).toBe(10000);
    expect(r?.payee).toBe("SARAH");
  });
});
