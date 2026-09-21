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
  group?: string;
}): { item: Item; isNew: boolean } {
  const normalizedName = normalizeItemName(params.rawName);
  const match = params.existing.find(
    (item) => !item.isArchived && item.normalizedName === normalizedName,
  );
  if (match) {
    // A unit or group learned later fills a gap, but never overwrites one
    // already known: the earlier answer was given deliberately.
    const unit = params.unit?.trim();
    const group = params.group?.trim();
    const learnedUnit = unit && !match.unit ? unit : undefined;
    const learnedGroup = group && !match.group ? group : undefined;

    if (learnedUnit || learnedGroup) {
      return {
        item: {
          ...match,
          unit: learnedUnit ?? match.unit,
          group: learnedGroup ?? match.group,
          updatedAt: params.timestamp,
        },
        isNew: true,
      };
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
      group: params.group?.trim() || undefined,
      isArchived: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  };
}
