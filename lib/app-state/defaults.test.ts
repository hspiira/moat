import { describe, expect, it } from "vitest";

import {
  FEES_CATEGORY_ID,
  WRITE_OFF_CATEGORY_ID,
  buildDefaultCategories,
  buildFeesCategory,
  defaultAccountTypes,
  reconcileDefaultCategories,
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
      category.id === "category:debt-repayment"
        ? { ...category, kind: "expense" as const }
        : category,
    );

    const fixes = reconcileDefaultCategories(stale, "user:1");

    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      id: "category:debt-repayment",
      kind: "debt_repayment",
    });
  });

  it("adds defaults that did not exist when the device was set up", () => {
    const older = current.filter(
      (category) => !["category:lending", "category:tips"].includes(category.id),
    );

    expect([...reconcileDefaultCategories(older, "user:1").map((c) => c.id)].sort()).toEqual([
      "category:lending",
      "category:tips",
    ]);
  });

  it("keeps the original createdAt when correcting a kind", () => {
    const stale = current.map((category) =>
      category.id === "category:debt-repayment"
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

  it("gives debt repayment and lending their own kinds, out of the expense list", () => {
    const categories = buildDefaultCategories("user:1");

    expect(categories.find((c) => c.id === "category:debt-repayment")?.kind).toBe(
      "debt_repayment",
    );
    expect(categories.find((c) => c.id === "category:lending")?.kind).toBe("lending");
  });

  it("already covers giving, so no gifts category is added", () => {
    const categories = buildDefaultCategories("user:1");

    expect(categories.some((c) => c.id === "category:family-support")).toBe(true);
    expect(categories.some((c) => c.id === "category:church-giving")).toBe(true);
    expect(categories.some((c) => c.id === "category:gifts-family")).toBe(false);
  });
});
