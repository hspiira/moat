import { describe, expect, it } from "vitest";

import { learnItemCategory } from "@/lib/domain/item-category";
import type { Item } from "@/lib/types";

const STAMP = "2026-08-22T10:00:00.000Z";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "item:rice",
    userId: "user:default",
    name: "Rice",
    normalizedName: "rice",
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

describe("learnItemCategory", () => {
  it("takes the category the spending was filed under", () => {
    expect(learnItemCategory(item(), "category:food", STAMP)?.defaultCategoryId).toBe(
      "category:food",
    );
  });

  it("says nothing changed when it already knew", () => {
    expect(learnItemCategory(item({ defaultCategoryId: "category:food" }), "category:food", STAMP))
      .toBeNull();
  });

  it("follows a change of mind", () => {
    expect(
      learnItemCategory(item({ defaultCategoryId: "category:food" }), "category:household", STAMP)
        ?.defaultCategoryId,
    ).toBe("category:household");
  });

  it("does not unset what it knew for a blank category", () => {
    expect(learnItemCategory(item({ defaultCategoryId: "category:food" }), "", STAMP)).toBeNull();
  });
})
