import { describe, expect, it } from "vitest";

import { formatAmountForInput, parseAmountInput } from "./parse-amount";

describe("parseAmountInput", () => {
  it("reads a grouped amount as a number", () => {
    expect(parseAmountInput("1,790,590")).toBe(1_790_590);
  });

  it("reads a plain amount", () => {
    expect(parseAmountInput("36000")).toBe(36_000);
  });

  it("keeps the decimal point for currencies that use one", () => {
    expect(parseAmountInput("1,234.56")).toBe(1234.56);
  });

  it("tolerates the separators people actually paste", () => {
    // Spaces and non-breaking spaces arrive from copied bank statements;
    // apostrophes from Swiss-formatted exports.
    expect(parseAmountInput("1 790 590")).toBe(1_790_590);
    expect(parseAmountInput("1 790 590")).toBe(1_790_590);
    expect(parseAmountInput("1'790'590")).toBe(1_790_590);
  });

  it("ignores a currency prefix pasted along with the number", () => {
    expect(parseAmountInput("UGX 1,000")).toBe(1000);
    expect(parseAmountInput("USh 2,875")).toBe(2875);
  });

  it("keeps a leading minus", () => {
    expect(parseAmountInput("-36,000")).toBe(-36_000);
  });

  it("returns null for nothing typed yet, so the field can stay empty", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("   ")).toBeNull();
  });

  it("returns null when there is no number in the text", () => {
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("-")).toBeNull();
    expect(parseAmountInput(",")).toBeNull();
    expect(parseAmountInput(".")).toBeNull();
  });

  it("returns null rather than a half-read number for mixed junk", () => {
    expect(parseAmountInput("12ab34")).toBeNull();
    expect(parseAmountInput("1.2.3")).toBeNull();
  });

  it("accepts a trailing decimal point mid-typing", () => {
    expect(parseAmountInput("1234.")).toBe(1234);
  });
});

describe("formatAmountForInput", () => {
  it("groups thousands so a long amount stays readable", () => {
    expect(formatAmountForInput(1_790_590)).toBe("1,790,590");
  });

  it("keeps decimals when they carry value", () => {
    expect(formatAmountForInput(1234.5)).toBe("1,234.5");
    expect(formatAmountForInput(1234.56)).toBe("1,234.56");
  });

  it("renders an empty field for no amount", () => {
    expect(formatAmountForInput(undefined)).toBe("");
    expect(formatAmountForInput(null)).toBe("");
  });

  it("renders a zero amount as an empty field, not a stray 0", () => {
    // A parsed capture with no fee should show a blank fee box.
    expect(formatAmountForInput(0)).toBe("");
  });

  it("round-trips with the parser", () => {
    for (const value of [0.5, 7, 2875, 36_000, 1_790_590]) {
      expect(parseAmountInput(formatAmountForInput(value))).toBe(value);
    }
  });
});
