import { describe, expect, it } from "vitest";

import { parseStatedBalance } from "./normalizers";

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
