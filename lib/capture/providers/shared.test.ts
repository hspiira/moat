import { describe, expect, it } from "vitest";

import { parseCaptureFee } from "./shared";
import { parseMtnUgandaMessage } from "./mtn-uganda";

describe("parseCaptureFee", () => {
  it("sums fee, tax, and excise-duty lines", () => {
    expect(
      parseCaptureFee("Sent UGX 50,000 to JOHN. Fee UGX 1,000. Tax UGX 250."),
    ).toBe(1250);
    expect(parseCaptureFee("Withdraw UGX 100,000. Fee 2,200. Excise duty UGX 220.")).toBe(2420);
  });

  it("returns undefined when there are no charge lines", () => {
    expect(parseCaptureFee("Received UGX 500,000 from Employer Ltd")).toBeUndefined();
  });

  it("does not match 'charge' inside another word", () => {
    expect(parseCaptureFee("Airtime recharge UGX 5,000 successful")).toBeUndefined();
  });
});

describe("parseMtnUgandaMessage fee extraction", () => {
  it("attaches the summed fee to an outgoing message", () => {
    const result = parseMtnUgandaMessage("Sent UGX 50,000 to JOHN DOE. Fee UGX 1,000. Tax UGX 250");
    expect(result?.type).toBe("expense");
    expect(result?.feeAmount).toBe(1250);
  });

  it("does not attach a fee to an incoming message", () => {
    const result = parseMtnUgandaMessage("Received UGX 500,000 from Employer Ltd on 27-03-2026");
    expect(result?.type).toBe("income");
    expect(result?.feeAmount).toBeUndefined();
  });
});
