import { describe, expect, it } from "vitest";

import {
  countCategoryUsage,
  orderCategoriesForPicker,
} from "@/lib/domain/category-usage";
import type { Category, CategoryKind, Transaction } from "@/lib/types";

function category(id: string, name: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    userId: "user:default",
    name,
    kind: "expense" as CategoryKind,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(categoryId: string, id: string): Transaction {
  return {
    id,
    userId: "user:default",
    accountId: "account:wallet",
    type: "expense",
    amount: 1000,
    currency: "UGX",
    originalAmount: 1000,
    occurredOn: "2026-07-01",
    categoryId,
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("countCategoryUsage", () => {
  it("counts how many transactions use each category", () => {
    const usage = countCategoryUsage([
      transaction("category:food", "t1"),
      transaction("category:food", "t2"),
      transaction("category:rent", "t3"),
    ]);

    expect(usage.get("category:food")).toBe(2);
    expect(usage.get("category:rent")).toBe(1);
  });

  it("reports nothing for a category never used", () => {
    const usage = countCategoryUsage([transaction("category:food", "t1")]);

    expect(usage.get("category:rent")).toBeUndefined();
  });

  it("returns an empty count for an empty ledger", () => {
    expect(countCategoryUsage([]).size).toBe(0);
  });
});

describe("orderCategoriesForPicker", () => {
  const food = category("category:food", "Food");
  const rent = category("category:rent", "Rent");
  const health = category("category:health", "Health");

  it("puts the most used category first", () => {
    const usage = new Map([
      ["category:rent", 3],
      ["category:food", 9],
    ]);

    expect(
      orderCategoriesForPicker([food, rent, health], usage).map((entry) => entry.name),
    ).toEqual(["Food", "Rent", "Health"]);
  });

  it("sorts unused categories by name, after the used ones", () => {
    const usage = new Map([["category:rent", 1]]);

    expect(
      orderCategoriesForPicker([health, food, rent], usage).map((entry) => entry.name),
    ).toEqual(["Rent", "Food", "Health"]);
  });

  it("breaks a tie on name, so the order never jumps about", () => {
    const usage = new Map([
      ["category:food", 4],
      ["category:rent", 4],
    ]);

    expect(
      orderCategoriesForPicker([rent, food], usage).map((entry) => entry.name),
    ).toEqual(["Food", "Rent"]);
  });

  it("leaves out a hidden category", () => {
    const hidden = category("category:tips", "Tips", { isArchived: true });

    expect(
      orderCategoriesForPicker([food, hidden], new Map()).map((entry) => entry.name),
    ).toEqual(["Food"]);
  });

  it("keeps a hidden category that is still in use", () => {
    const hidden = category("category:tips", "Tips", { isArchived: true });
    const usage = new Map([["category:tips", 2]]);

    expect(
      orderCategoriesForPicker([food, hidden], usage).map((entry) => entry.name),
    ).toEqual(["Tips", "Food"]);
  });

  it("does not change the list it is given", () => {
    const input = [rent, food];
    orderCategoriesForPicker(input, new Map([["category:food", 5]]));

    expect(input.map((entry) => entry.name)).toEqual(["Rent", "Food"]);
  });
});
