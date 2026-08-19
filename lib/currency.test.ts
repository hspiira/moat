import { describe, expect, it } from "vitest";

import { formatMoney, formatMoneyShort, normalizeAmountToUgx } from "@/lib/currency";

describe("normalizeAmountToUgx", () => {
  it("passes UGX through as a magnitude", () => {
    expect(normalizeAmountToUgx(-4500, "UGX")).toBe(4500);
  });

  it("converts to whole shillings", () => {
    expect(normalizeAmountToUgx(12.34, "USD", 3700.5)).toBe(45664);
    expect(Number.isInteger(normalizeAmountToUgx(19.99, "USD", 3712.37))).toBe(true);
  });

  it("rounds half away from zero rather than truncating", () => {
    expect(normalizeAmountToUgx(1.5, "USD", 1)).toBe(2);
  });

  it("keeps a converted pair cancelling exactly", () => {
    const leg = normalizeAmountToUgx(12.34, "USD", 3700.5);
    expect(leg + -leg).toBe(0);
  });

  it("refuses a missing or nonsense rate", () => {
    expect(normalizeAmountToUgx(10, "USD")).toBeNaN();
    expect(normalizeAmountToUgx(10, "USD", 0)).toBeNaN();
    expect(normalizeAmountToUgx(10, "USD", -5)).toBeNaN();
    expect(normalizeAmountToUgx(10, "USD", Number.NaN)).toBeNaN();
  });
});

describe("formatMoneyShort", () => {
  it("shortens the symbol for a list of transactions", () => {
    expect(formatMoneyShort(154_500)).toBe("Sh\u00a0154,500");
  });

  it("groups thousands exactly as the full form does", () => {
    expect(formatMoneyShort(3_000_000)).toBe("Sh\u00a03,000,000");
  });

  it("differs from the full form by one character, and only that", () => {
    expect(`U${formatMoneyShort(154_500)}`).toBe(formatMoney(154_500));
  });

  it("keeps UGX whole, matching how it is stored", () => {
    expect(formatMoneyShort(500)).toBe("Sh\u00a0500");
  });

  it("leaves a currency with no short form alone", () => {
    expect(formatMoneyShort(20, "USD")).toBe(formatMoney(20, "USD"));
  });
});
