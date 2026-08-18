import { describe, expect, it } from "vitest";

import { categoryOptionGroups } from "@/lib/select-options";
import type { Category, CategoryKind } from "@/lib/types";

function category(id: string, name: string, kind: CategoryKind): Category {
  return {
    id,
    userId: "user:default",
    name,
    kind,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("categoryOptionGroups", () => {
  const catalogue: Category[] = [
    category("category:food", "Food", "expense"),
    category("category:salary", "Salary", "income"),
    category("category:debt-repayment", "Debt repayment", "debt_repayment"),
    category("category:lending", "Lending", "lending"),
    category("category:transfers", "Transfers", "transfer"),
    category("category:savings", "Savings", "savings"),
  ];

  it("heads each group with wording that carries what the type used to say", () => {
    expect(categoryOptionGroups(catalogue).map((group) => group.label)).toEqual([
      "Income",
      "Spending",
      "Savings",
      "Transfers",
      "Debt",
      "Lending",
    ]);
  });

  it("files each category under its own kind", () => {
    const groups = categoryOptionGroups(catalogue);
    const spending = groups.find((group) => group.label === "Spending");
    const debt = groups.find((group) => group.label === "Debt");

    expect(spending?.options.map((option) => option.label)).toEqual(["Food"]);
    expect(debt?.options.map((option) => option.label)).toEqual(["Debt repayment"]);
  });

  it("offers every category exactly once, so none becomes unreachable", () => {
    const offered = categoryOptionGroups(catalogue).flatMap((group) =>
      group.options.map((option) => option.value),
    );

    expect([...offered].sort()).toEqual([...catalogue.map((entry) => entry.id)].sort());
  });

  it("drops empty groups rather than rendering a bare heading", () => {
    const groups = categoryOptionGroups([category("category:food", "Food", "expense")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Spending");
  });

  it("returns nothing when there are no categories", () => {
    expect(categoryOptionGroups([])).toEqual([]);
  });
});
