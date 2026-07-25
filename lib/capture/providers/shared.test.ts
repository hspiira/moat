import { describe, expect, it } from "vitest";

import { cleanCapturePayee, parseCaptureFee, toIsoDate } from "./shared";
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

describe("cleanCapturePayee", () => {
  it("cuts the greedy tail at the first real delimiter", () => {
    expect(
      cleanCapturePayee("MILLY NAKIRANDA, 256785363402 on 2026-06-27 16:56:59, fee: 0."),
    ).toBe("MILLY NAKIRANDA");
    expect(cleanCapturePayee("256703442862, HENRYSSEKIBO. Fee:UGX 100.00.")).toBe(
      "256703442862, HENRYSSEKIBO",
    );
    expect(cleanCapturePayee("MTN MoMo INTEREST PAYOUT on 2026-07-17 23:23:11.")).toBe(
      "MTN MoMo INTEREST PAYOUT",
    );
    expect(cleanCapturePayee("Centenary Bank . on 2026-06-27 09:25:41.")).toBe("Centenary Bank");
  });
});

describe("toIsoDate named month", () => {
  it("parses dd-Month-yyyy", () => {
    expect(toIsoDate("23-July-2026")).toBe("2026-07-23");
    expect(toIsoDate("05-Jan-2026")).toBe("2026-01-05");
  });
});

describe("parseCaptureFee zero", () => {
  it("returns undefined when the total is zero", () => {
    expect(parseCaptureFee("Fee: 0")).toBeUndefined();
    expect(parseCaptureFee("Mobile App Charge UGX 0")).toBeUndefined();
  });
});
