import { describe, expect, it } from "vitest";

import {
  categoryMatchKey,
  findCategoryByName,
  findDuplicateCategories,
  isReservedCategory,
  planCategoryMerge,
  planCategoryMoveInto,
} from "@/lib/domain/category-merge";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Category } from "@/lib/types";

const USER = "user:1";

const category = (
  id: string,
  name: string,
  overrides: Partial<Category> = {},
): Category => ({
  id,
  userId: USER,
  name,
  kind: "expense",
  isDefault: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("categoryMatchKey", () => {
  it("reads punctuation and spacing as noise", () => {
    expect(categoryMatchKey("Transport / boda")).toBe(categoryMatchKey("transport boda"));
    expect(categoryMatchKey("Airtime/Data")).toBe(categoryMatchKey("Airtime / data"));
  });

  it("keeps genuinely different names apart", () => {
    expect(categoryMatchKey("Rent")).not.toBe(categoryMatchKey("Rental"));
  });
});

describe("findCategoryByName", () => {
  it("finds a match whatever the casing and spacing", () => {
    const categories = [category("c:1", "Transport / boda")];

    expect(findCategoryByName(categories, "transport boda", "expense")?.id).toBe("c:1");
  });

  it("does not cross kinds, because savings and spending are different things", () => {
    const categories = [category("c:1", "Savings", { kind: "savings" })];

    expect(findCategoryByName(categories, "Savings", "expense")).toBeUndefined();
  });
});

describe("findDuplicateCategories", () => {
  it("keeps the copy that already holds the transactions", () => {
    const groups = findDuplicateCategories(
      [category("c:empty", "Rent"), category("c:used", "Rent")],
      new Map([["c:used", 12]]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].survivor.id).toBe("c:used");
    expect(groups[0].duplicates.map((entry) => entry.id)).toEqual(["c:empty"]);
  });

  it("keeps the reserved copy even when the other one is busier", () => {
    const reserved = category(feesCategoryId(USER), "Fees & charges", { isDefault: true });
    const groups = findDuplicateCategories(
      [category("c:other", "Fees & charges", { isDefault: true }), reserved],
      new Map([["c:other", 40]]),
    );

    expect(groups[0].survivor.id).toBe(reserved.id);
  });

  it("leaves same-named categories of different kinds alone", () => {
    expect(
      findDuplicateCategories([
        category("c:1", "Savings", { kind: "savings" }),
        category("c:2", "Savings", { kind: "expense" }),
      ]),
    ).toEqual([]);
  });

  it("reads a reserved id off the derived slug, not the name", () => {
    expect(isReservedCategory(category(feesCategoryId(USER), "Anything"))).toBe(true);
    expect(isReservedCategory(category("c:1", "Fees & charges"))).toBe(false);
  });
});

describe("planCategoryMerge", () => {
  it("points every duplicate at the survivor and clears the rest", () => {
    const plan = planCategoryMerge(
      [category("c:used", "Rent"), category("c:a", "rent"), category("c:b", "Rent ")],
      new Map([["c:used", 3]]),
    );

    expect(plan.moves).toEqual([
      { fromId: "c:a", toId: "c:used" },
      { fromId: "c:b", toId: "c:used" },
    ]);
    expect(plan.removedIds).toEqual(["c:a", "c:b"]);
  });

  it("asks for nothing when every name is its own", () => {
    expect(planCategoryMerge([category("c:1", "Rent"), category("c:2", "Food")])).toMatchObject({
      moves: [],
      removedIds: [],
      survivors: [],
    });
  });

  it("dates the survivor from the oldest copy, so history keeps its age", () => {
    const plan = planCategoryMerge(
      [
        category("c:used", "Rent", { createdAt: "2026-05-01T00:00:00.000Z" }),
        category("c:old", "Rent", { createdAt: "2024-02-02T00:00:00.000Z" }),
      ],
      new Map([["c:used", 3]]),
    );

    expect(plan.survivors[0]).toMatchObject({
      id: "c:used",
      createdAt: "2024-02-02T00:00:00.000Z",
    });
  });

  it("survives as the visible copy when one of the pair is hidden", () => {
    const plan = planCategoryMerge([
      category("c:hidden", "Rent", { isArchived: true }),
      category("c:visible", "Rent"),
    ]);

    expect(plan.removedIds).toEqual(["c:hidden"]);
  });

  it("does not fold a category into itself", () => {
    const plan = planCategoryMerge([category("c:1", "Rent")]);

    expect(plan.removedIds).toEqual([]);
  });
});

describe("planCategoryMoveInto", () => {
  it("moves the sources across and clears them", () => {
    expect(planCategoryMoveInto(["c:1", "c:2"], "c:keep")).toMatchObject({
      moves: [
        { fromId: "c:1", toId: "c:keep" },
        { fromId: "c:2", toId: "c:keep" },
      ],
      removedIds: ["c:1", "c:2"],
    });
  });

  it("refuses to move a category into itself", () => {
    expect(planCategoryMoveInto(["c:keep"], "c:keep")).toMatchObject({
      moves: [],
      removedIds: [],
    });
  });
});
