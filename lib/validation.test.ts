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
