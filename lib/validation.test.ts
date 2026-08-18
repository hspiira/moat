import { describe, expect, it } from "vitest";

import { isPastDate, validateAmount, validateInteger } from "@/lib/validation";

describe("validateAmount", () => {
  it("rejects empty, non-numeric, negative, and zero by default", () => {
    expect(validateAmount("")).toBeTruthy();
    expect(validateAmount("abc")).toBe("Enter a valid number.");
    expect(validateAmount("-5")).toBe("This can't be negative.");
    expect(validateAmount("0")).toBe("Enter an amount greater than zero.");
  });

  it("accepts a positive number", () => {
    expect(validateAmount("1500")).toBeNull();
    expect(validateAmount("  1500  ")).toBeNull();
  });

  it("accepts a grouped amount, because that is how people type money", () => {
    expect(validateAmount("50,000")).toBeNull();
    expect(validateAmount("1,790,590")).toBeNull();
    expect(validateAmount("-2,000")).toBe("This can't be negative.");
  });

  it("allows zero and negatives when opted in (debt opening balance)", () => {
    expect(validateAmount("0", { allowZero: true })).toBeNull();
    expect(validateAmount("-200000", { allowZero: true, allowNegative: true })).toBeNull();
  });
});

describe("validateInteger", () => {
  it("enforces an inclusive range and whole numbers", () => {
    expect(validateInteger("0", 1, 31)).toBe("Enter a number between 1 and 31.");
    expect(validateInteger("45", 1, 31)).toBe("Enter a number between 1 and 31.");
    expect(validateInteger("2.5", 1, 31)).toBe("Enter a whole number.");
    expect(validateInteger("", 1, 31)).toBeTruthy();
    expect(validateInteger("15", 1, 31)).toBeNull();
  });
});

describe("isPastDate", () => {
  it("is true for dates before today and false otherwise", () => {
    expect(isPastDate("2000-01-01")).toBe(true);
    expect(isPastDate("2999-12-31")).toBe(false);
    expect(isPastDate("")).toBe(false);
  });
});

describe("validateAmount and whole shillings", () => {
  it("refuses a fraction, because UGX has no subdivision", () => {
    expect(validateAmount("1110.19")).toBe("Enter a whole number of shillings.");
    expect(validateAmount("0.5", { allowZero: true })).toBe("Enter a whole number of shillings.");
  });

  it("still accepts whole and grouped figures", () => {
    expect(validateAmount("1110")).toBeNull();
    expect(validateAmount("1,790,590")).toBeNull();
    expect(validateAmount("-4500", { allowNegative: true })).toBeNull();
  });

  it("allows a fraction only when the caller asks, for a foreign amount", () => {
    expect(validateAmount("12.34", { allowFraction: true })).toBeNull();
  });
});
