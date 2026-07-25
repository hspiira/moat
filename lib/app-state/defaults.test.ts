import { describe, expect, it } from "vitest";

import {
  FEES_CATEGORY_ID,
  buildDefaultCategories,
  buildFeesCategory,
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
