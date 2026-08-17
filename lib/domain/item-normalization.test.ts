import { describe, expect, it } from "vitest";

import { normalizeItemName, resolveItem } from "@/lib/domain/item-normalization";
import type { Item } from "@/lib/types";
import { isValidId } from "@/lib/ids";

const now = "2026-08-07T00:00:00.000Z";

const sugar: Item = {
  id: "item:sugar",
  userId: "user-1",
  name: "Sugar (1kg)",
  normalizedName: "sugar (1kg)",
  isArchived: false,
  createdAt: now,
  updatedAt: now,
};

describe("normalizeItemName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeItemName("  Sugar   (1kg) ")).toBe("sugar (1kg)");
  });

  it("is idempotent", () => {
    const once = normalizeItemName("  Kakira   SUGAR ");
    expect(normalizeItemName(once)).toBe(once);
  });
});

describe("resolveItem", () => {
  it("reuses an existing item on a normalized match", () => {
    const resolved = resolveItem({
      existing: [sugar],
      rawName: "  SUGAR (1kg)",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(false);
    expect(resolved.item).toBe(sugar);
  });

  it("creates a new item preserving the raw display name", () => {
    const resolved = resolveItem({
      existing: [sugar],
      rawName: " Cooking Oil ",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(true);
    expect(resolved.item.name).toBe("Cooking Oil");
    expect(resolved.item.normalizedName).toBe("cooking oil");
    expect(isValidId(resolved.item.id)).toBe(true);
    expect(resolved.item.isArchived).toBe(false);
  });

  it("does not match archived items", () => {
    const archived = { ...sugar, isArchived: true };
    const resolved = resolveItem({
      existing: [archived],
      rawName: "sugar (1kg)",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(true);
  });
});
