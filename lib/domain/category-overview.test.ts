import { describe, expect, it } from "vitest";

import { buildCategoryOverview, isCategoryInUse } from "@/lib/domain/category-overview";
import type { Category, Transaction } from "@/lib/types";

const category = (id: string, name: string, kind: Category["kind"] = "expense"): Category => ({
  id,
  userId: "u1",
  name,
  kind,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const spend = (categoryId: string, amount: number, occurredOn: string): Transaction => ({
  id: `t:${categoryId}:${occurredOn}:${amount}`,
  userId: "u1",
  accountId: "account:1",
  type: "expense",
  amount,
  currency: "UGX",
  originalAmount: amount,
  occurredOn,
  categoryId,
  reconciliationState: "posted",
  source: "manual",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("buildCategoryOverview", () => {
  it("totals what each category actually cost", () => {
    const groups = buildCategoryOverview(
      [category("c:food", "Food")],
      [spend("c:food", 30000, "2026-08-01"), spend("c:food", 12000, "2026-08-04")],
    );

    expect(groups[0].uses[0]).toMatchObject({ count: 2, total: 42000, lastUsedOn: "2026-08-04" });
  });

  it("puts the biggest first so the ones that matter lead", () => {
    const groups = buildCategoryOverview(
      [category("c:a", "Airtime"), category("c:b", "Boda"), category("c:c", "Chai")],
      [spend("c:a", 5000, "2026-08-01"), spend("c:b", 90000, "2026-08-01")],
    );

    expect(groups[0].uses.map((use) => use.category.name)).toEqual(["Boda", "Airtime", "Chai"]);
  });

  it("orders unused ones by name rather than leaving them scattered", () => {
    const groups = buildCategoryOverview(
      [category("c:z", "Zakat"), category("c:a", "Airtime")],
      [],
    );

    expect(groups[0].uses.map((use) => use.category.name)).toEqual(["Airtime", "Zakat"]);
  });

  it("reads a magnitude, so income and spending compare", () => {
    const groups = buildCategoryOverview(
      [category("c:s", "Salary", "income")],
      [{ ...spend("c:s", -500000, "2026-08-01"), type: "income" }],
    );

    expect(groups[0].uses[0].total).toBe(500000);
  });

  it("groups by kind and drops kinds with no categories", () => {
    const groups = buildCategoryOverview(
      [category("c:f", "Food"), category("c:s", "Salary", "income")],
      [],
    );

    expect(groups.map((group) => group.kind).sort()).toEqual(["expense", "income"]);
  });

  it("marks a category a transaction still points at", () => {
    const [group] = buildCategoryOverview(
      [category("c:food", "Food"), category("c:unused", "Unused")],
      [spend("c:food", 1000, "2026-08-01")],
    );

    expect(isCategoryInUse(group.uses[0])).toBe(true);
    expect(isCategoryInUse(group.uses[1])).toBe(false);
  });
});
