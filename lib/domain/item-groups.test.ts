import { describe, expect, it } from "vitest";

import { groupPurchasesByItemGroup, isWorthGrouping } from "./item-groups";
import type { Item, PlannedPurchase } from "@/lib/types";

function item(id: string, group?: string): Item {
  return {
    id,
    userId: "user:1",
    name: id,
    normalizedName: id,
    group,
    isArchived: false,
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
  };
}

function purchase(id: string, itemId: string): PlannedPurchase {
  return { id, itemId, status: "planned" } as PlannedPurchase;
}

const itemsById = new Map([
  ["rice", item("rice", "Groceries")],
  ["sugar", item("sugar", "Groceries")],
  ["couch", item("couch", "Furniture")],
  ["odd", item("odd")],
]);

describe("groupPurchasesByItemGroup", () => {
  it("gathers what belongs together", () => {
    const grouped = groupPurchasesByItemGroup(
      [purchase("p1", "rice"), purchase("p2", "couch"), purchase("p3", "sugar")],
      itemsById,
    );

    expect(grouped.map((entry) => entry.group)).toEqual(["Furniture", "Groceries"]);
    expect(grouped[1].purchases.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  /* Ungrouped items are not a category called "other". They are the ones nobody
     has filed yet, so they sit at the end without a name over them. */
  it("leaves the unfiled ones last and unnamed", () => {
    const grouped = groupPurchasesByItemGroup(
      [purchase("p1", "odd"), purchase("p2", "rice")],
      itemsById,
    );

    expect(grouped.map((entry) => entry.group)).toEqual(["Groceries", ""]);
  });

  it("keeps the order items were given within a group", () => {
    const grouped = groupPurchasesByItemGroup(
      [purchase("p3", "sugar"), purchase("p1", "rice")],
      itemsById,
    );

    expect(grouped[0].purchases.map((p) => p.id)).toEqual(["p3", "p1"]);
  });

  it("treats a group of spaces as no group", () => {
    const spaced = new Map([["x", item("x", "   ")]]);

    expect(groupPurchasesByItemGroup([purchase("p1", "x")], spaced)[0].group).toBe("");
  });

  it("copes with an item it cannot find", () => {
    expect(groupPurchasesByItemGroup([purchase("p1", "missing")], itemsById)[0].group).toBe("");
  });

  it("has nothing to gather from nothing", () => {
    expect(groupPurchasesByItemGroup([], itemsById)).toEqual([]);
  });
});

describe("isWorthGrouping", () => {
  /* A heading over the whole list says nothing, and neither does one over a list
     where nothing has been filed. */
  it("is not worth it when nothing is filed", () => {
    expect(isWorthGrouping(groupPurchasesByItemGroup([purchase("p1", "odd")], itemsById))).toBe(
      false,
    );
  });

  it("is not worth it when everything is in one group", () => {
    expect(
      isWorthGrouping(
        groupPurchasesByItemGroup([purchase("p1", "rice"), purchase("p2", "sugar")], itemsById),
      ),
    ).toBe(false);
  });

  it("is worth it once there is more than one heading to give", () => {
    expect(
      isWorthGrouping(
        groupPurchasesByItemGroup([purchase("p1", "rice"), purchase("p2", "couch")], itemsById),
      ),
    ).toBe(true);
  });

  it("is worth it when some are filed and some are not", () => {
    expect(
      isWorthGrouping(
        groupPurchasesByItemGroup([purchase("p1", "rice"), purchase("p2", "odd")], itemsById),
      ),
    ).toBe(true);
  });
});
