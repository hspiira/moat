import { describe, expect, it } from "vitest";

import { buildCaptureFieldWarnings, deriveCaptureConfidence } from "./confidence";

const readable = {
  originalAmount: 15000,
  currency: "UGX" as const,
  occurredOn: "2026-04-07",
  payee: "Grocery",
  categoryId: "category:expense",
};

function fieldsOf(warnings: ReturnType<typeof buildCaptureFieldWarnings>) {
  return warnings.map((warning) => warning.field);
}

describe("buildCaptureFieldWarnings", () => {
  it("says nothing about a message it could read every field from", () => {
    expect(buildCaptureFieldWarnings(readable)).toEqual([]);
  });

  it("warns on an amount it could not read", () => {
    expect(fieldsOf(buildCaptureFieldWarnings({ ...readable, originalAmount: 0 }))).toContain(
      "amount",
    );
    expect(fieldsOf(buildCaptureFieldWarnings({ ...readable, originalAmount: -5 }))).toContain(
      "amount",
    );
    expect(fieldsOf(buildCaptureFieldWarnings({ ...readable, originalAmount: NaN }))).toContain(
      "amount",
    );
  });

  it("warns when no date was found", () => {
    expect(fieldsOf(buildCaptureFieldWarnings({ ...readable, occurredOn: undefined }))).toContain(
      "date",
    );
  });

  /* An amount in another currency cannot be posted against a UGX ledger without
     a rate, so this is the one that blocks rather than informs. */
  it("warns that a foreign amount needs a rate, and only while it lacks one", () => {
    const withoutRate = buildCaptureFieldWarnings({ ...readable, currency: "USD" });
    expect(withoutRate.find((warning) => warning.field === "currency")?.level).toBe("warning");

    const withRate = buildCaptureFieldWarnings({
      ...readable,
      currency: "USD",
      fxRateToUgx: 3800,
    });
    expect(fieldsOf(withRate)).not.toContain("currency");
  });

  it("treats a rate of zero as no rate at all", () => {
    expect(
      fieldsOf(buildCaptureFieldWarnings({ ...readable, currency: "USD", fxRateToUgx: 0 })),
    ).toContain("currency");
  });

  /* Only warnings reach the issue list that holds a capture back. A missing
     payee or category is worth showing and not worth blocking on. */
  it("keeps a missing payee or category to information", () => {
    const warnings = buildCaptureFieldWarnings({
      ...readable,
      payee: undefined,
      categoryId: undefined,
    });

    expect(warnings.filter((warning) => warning.level === "info").map((w) => w.field)).toEqual([
      "payee",
      "type",
    ]);
  });

  it("counts a blank payee as none", () => {
    expect(fieldsOf(buildCaptureFieldWarnings({ ...readable, payee: "   " }))).toContain("payee");
  });
});

describe("deriveCaptureConfidence", () => {
  const complete = {
    baseBoost: 0,
    originalAmount: 15000,
    occurredOn: "2026-04-07",
    payee: "Grocery",
    categoryId: "category:expense",
    warningCount: 0,
  };

  /* Reading every field scores 0.85, not the 0.95 ceiling: the last of it is
     reserved for a provider pack recognising the sender, so a bank message a
     pack knows always outranks an equally complete one it does not. */
  it("stops short of the ceiling for a message no provider pack claimed", () => {
    expect(deriveCaptureConfidence(complete)).toBeCloseTo(0.85);
  });

  it("puts a recognised sender above an equally complete unrecognised one", () => {
    expect(deriveCaptureConfidence({ ...complete, baseBoost: 0.1 })).toBeGreaterThan(
      deriveCaptureConfidence(complete),
    );
  });

  it("never claims certainty, however much a provider pack vouches for it", () => {
    expect(deriveCaptureConfidence({ ...complete, baseBoost: 10 })).toBe(0.95);
  });

  it("never falls to nothing, however little it could read", () => {
    expect(
      deriveCaptureConfidence({
        baseBoost: 0,
        originalAmount: NaN,
        warningCount: 20,
      }),
    ).toBe(0.1);
  });

  it("drops as each field goes unread", () => {
    const withoutPayee = deriveCaptureConfidence({ ...complete, payee: undefined });
    const withoutDate = deriveCaptureConfidence({ ...complete, occurredOn: undefined });

    expect(withoutPayee).toBeLessThan(deriveCaptureConfidence(complete));
    expect(withoutDate).toBeLessThan(deriveCaptureConfidence(complete));
  });

  /* A field that could not be read both withholds its own credit and raises a
     warning, so it counts against the score twice. That is deliberate: a
     capture missing two fields should not read as merely a little less sure. */
  it("counts an unread field against the score twice", () => {
    const onlyMissing = deriveCaptureConfidence({ ...complete, occurredOn: undefined });
    const missingAndWarned = deriveCaptureConfidence({
      ...complete,
      occurredOn: undefined,
      warningCount: 1,
    });

    expect(onlyMissing - missingAndWarned).toBeCloseTo(0.05);
  });

  it("reads a blank payee as unread rather than as a payee", () => {
    expect(deriveCaptureConfidence({ ...complete, payee: "   " })).toBeLessThan(
      deriveCaptureConfidence(complete),
    );
  });
});
