import type { Item } from "@/lib/types";
import { createId } from "@/lib/ids";

export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Exact normalized match reuses the item; anything else creates one. Archived
 * items never match so a re-used name starts a fresh history on purpose.
 */
export function resolveItem(params: {
  existing: Item[];
  rawName: string;
  userId: string;
  timestamp: string;
}): { item: Item; isNew: boolean } {
  const normalizedName = normalizeItemName(params.rawName);
  const match = params.existing.find(
    (item) => !item.isArchived && item.normalizedName === normalizedName,
  );
  if (match) {
    return { item: match, isNew: false };
  }
  return {
    isNew: true,
    item: {
      id: createId(),
      userId: params.userId,
      name: params.rawName.trim().replace(/\s+/g, " "),
      normalizedName,
      isArchived: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  };
}
