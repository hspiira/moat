import type { Item } from "@/lib/types";
import { createId } from "@/lib/ids";

export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveItem(params: {
  existing: Item[];
  rawName: string;
  userId: string;
  timestamp: string;
  unit?: string;
}): { item: Item; isNew: boolean } {
  const normalizedName = normalizeItemName(params.rawName);
  const match = params.existing.find(
    (item) => !item.isArchived && item.normalizedName === normalizedName,
  );
  if (match) {
    // A unit learned later fills a gap, but never overwrites one already known.
    const unit = params.unit?.trim();
    if (unit && !match.unit) {
      return { item: { ...match, unit, updatedAt: params.timestamp }, isNew: true };
    }
    return { item: match, isNew: false };
  }
  return {
    isNew: true,
    item: {
      id: createId(),
      userId: params.userId,
      name: params.rawName.trim().replace(/\s+/g, " "),
      normalizedName,
      unit: params.unit?.trim() || undefined,
      isArchived: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  };
}
