import { describe, expect, it } from "vitest";

import {
  FEES_CATEGORY_ID,
  WRITE_OFF_CATEGORY_ID,
  buildDefaultCategories,
  buildFeesCategory,
  defaultAccountTypes,
} from "./defaults";

describe("fees category", () => {
  it("exposes the canonical id and a well-formed expense category", () => {
    const fees = buildFeesCategory("user:1");
    expect(FEES_CATEGORY_ID).toBe("category:fees-charges");
    expect(fees.id).toBe(FEES_CATEGORY_ID);
    expect(fees.kind).toBe("expense");
    expect(fees.name).toBe("Fees & charges");
    expect(fees.userId).toBe("user:1");
  });

  it("seeds the canonical fees category by default (no separate MoMo-charges seed)", () => {
    const categories = buildDefaultCategories("user:1");
    expect(categories.some((c) => c.id === FEES_CATEGORY_ID)).toBe(true);
    expect(categories.some((c) => c.id === "category:mobile-money-charges")).toBe(false);
  });
});

describe("lending and giving seeds", () => {
  it("offers receivable as an account type", () => {
    expect(defaultAccountTypes).toContain("receivable");
  });

  it("seeds tips as an ordinary expense", () => {
    const tips = buildDefaultCategories("user:1").find((c) => c.id === "category:tips");

    expect(tips?.name).toBe("Tips");
    expect(tips?.kind).toBe("expense");
  });

  it("seeds a write-off category so a bad loan can be booked as a loss", () => {
    const writeOff = buildDefaultCategories("user:1").find(
      (c) => c.id === WRITE_OFF_CATEGORY_ID,
    );

    expect(WRITE_OFF_CATEGORY_ID).toBe("category:money-written-off");
    expect(writeOff?.kind).toBe("expense");
  });

  it("already covers giving, so no gifts category is added", () => {
    const categories = buildDefaultCategories("user:1");

    expect(categories.some((c) => c.id === "category:family-support")).toBe(true);
    expect(categories.some((c) => c.id === "category:church-giving")).toBe(true);
    expect(categories.some((c) => c.id === "category:gifts-family")).toBe(false);
  });
});
