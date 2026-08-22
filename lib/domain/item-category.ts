import type { Item } from "@/lib/types";

// An item's category is learned from where its spending was filed, the same way
// its price is learned from what was paid. Asking for it up front would be one
// more field on a form nobody wants to fill in.
export function learnItemCategory(
  item: Item,
  categoryId: string,
  timestamp: string,
): Item | null {
  if (!categoryId || item.defaultCategoryId === categoryId) return null;
  return { ...item, defaultCategoryId: categoryId, updatedAt: timestamp };
}
