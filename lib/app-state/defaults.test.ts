import { describe, expect, it } from "vitest";

import { deriveSeededId } from "@/lib/ids";

import {
  feesCategoryId,
  writeOffCategoryId,
  buildDefaultCategories,
  buildFeesCategory,
  defaultAccountTypes,
  reconcileDefaultCategories,
} from "./defaults";

describe("fees category", () => {
  it("exposes the canonical id and a well-formed expense category", () => {
    const fees = buildFeesCategory("user:1");
    expect(fees.id).toBe(feesCategoryId("user:1"));
    expect(fees.id).toBe(feesCategoryId("user:1"));
    expect(fees.kind).toBe("expense");
    expect(fees.name).toBe("Fees & charges");
    expect(fees.userId).toBe("user:1");
  });

  it("seeds the canonical fees category by default (no separate MoMo-charges seed)", () => {
    const categories = buildDefaultCategories("user:1");
    expect(categories.some((c) => c.id === feesCategoryId("user:1"))).toBe(true);
    expect(categories.some((c) => c.id === deriveSeededId("user:1", "category:mobile-money-charges"))).toBe(false);
  });
});

describe("reconcileDefaultCategories", () => {
  const current = buildDefaultCategories("user:1");

  it("asks for nothing when every default is already current", () => {
    expect(reconcileDefaultCategories(current, "user:1")).toEqual([]);
  });

  it("corrects a default whose kind has changed since it was seeded", () => {
    // The real case: "Debt repayment" was seeded as an ordinary expense, so on
    // an existing device it still sits among Food and Airtime — and a debt
    // payment has no valid category at all.
    const stale = current.map((category) =>
      category.id === deriveSeededId("user:1", "category:debt-repayment")
        ? { ...category, kind: "expense" as const }
        : category,
    );

    const fixes = reconcileDefaultCategories(stale, "user:1");

    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      id: deriveSeededId("user:1", "category:debt-repayment"),
      kind: "debt_repayment",
    });
  });

  it("adds defaults that did not exist when the device was set up", () => {
    const older = current.filter(
      (category) => ![deriveSeededId("user:1", "category:lending"), deriveSeededId("user:1", "category:tips")].includes(category.id),
    );

    expect([...reconcileDefaultCategories(older, "user:1").map((c) => c.id)].sort()).toEqual(
      [
        deriveSeededId("user:1", "category:lending"),
        deriveSeededId("user:1", "category:tips"),
      ].sort(),
    );
  });

  it("keeps the original createdAt when correcting a kind", () => {
    const stale = current.map((category) =>
      category.id === deriveSeededId("user:1", "category:debt-repayment")
        ? { ...category, kind: "expense" as const, createdAt: "2020-05-05T00:00:00.000Z" }
        : category,
    );

    expect(reconcileDefaultCategories(stale, "user:1")[0].createdAt).toBe(
      "2020-05-05T00:00:00.000Z",
    );
  });

  it("never rewrites a category the user made themselves", () => {
    const userOwned = [
      ...current,
      {
        id: "category:my-own",
        userId: "user:1",
        name: "Boda to town",
        kind: "income" as const,
        isDefault: false,
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ];

    expect(reconcileDefaultCategories(userOwned, "user:1")).toEqual([]);
  });

  it("seeds everything for a device that has no categories at all", () => {
    expect(reconcileDefaultCategories([], "user:1")).toHaveLength(current.length);
  });
});

describe("lending and giving seeds", () => {
  it("offers receivable as an account type", () => {
    expect(defaultAccountTypes).toContain("receivable");
  });

  it("seeds tips as an ordinary expense", () => {
    const tips = buildDefaultCategories("user:1").find((c) => c.id === deriveSeededId("user:1", "category:tips"));

    expect(tips?.name).toBe("Tips");
    expect(tips?.kind).toBe("expense");
  });

  it("seeds a write-off category so a bad loan can be booked as a loss", () => {
    const writeOff = buildDefaultCategories("user:1").find(
      (c) => c.id === writeOffCategoryId("user:1"),
    );

    expect(writeOff?.id).toBe(writeOffCategoryId("user:1"));
    expect(writeOff?.kind).toBe("expense");
  });

  it("gives debt repayment and lending their own kinds, out of the expense list", () => {
    const categories = buildDefaultCategories("user:1");

    expect(categories.find((c) => c.id === deriveSeededId("user:1", "category:debt-repayment"))?.kind).toBe(
      "debt_repayment",
    );
    expect(categories.find((c) => c.id === deriveSeededId("user:1", "category:lending"))?.kind).toBe("lending");
  });

  it("already covers giving, so no gifts category is added", () => {
    const categories = buildDefaultCategories("user:1");

    expect(categories.some((c) => c.id === deriveSeededId("user:1", "category:family-support"))).toBe(true);
    expect(categories.some((c) => c.id === deriveSeededId("user:1", "category:church-giving"))).toBe(true);
    expect(categories.some((c) => c.id === deriveSeededId("user:1", "category:gifts-family"))).toBe(false);
  });
});
