import { describe, expect, it } from "vitest";

import { parseAbsaUgandaMessage } from "./absa-uganda";

describe("parseAbsaUgandaMessage", () => {
  it("parses an ATM cash withdrawal", () => {
    const r = parseAbsaUgandaMessage(
      "Absa confirms an ATM cash Withdrawal of UGX 100,000.00 on Acc. ending ***15 on 14/07/2026 at 08:46. Call 0800222333,+256312218348 for enquiries.",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(100000);
    expect(r?.payee).toBe("ATM cash withdrawal");
    expect(r?.occurredOn).toBe("2026-07-14");
  });

  it("returns null for unrelated text", () => {
    expect(parseAbsaUgandaMessage("Received UGX 500 from a friend")).toBeNull();
  });
});
