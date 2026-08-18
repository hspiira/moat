import { counterpartyMatchKey, widenKind } from "@/lib/domain/counterparties";
import type { Counterparty, Transaction } from "@/lib/types";

export type CounterpartyMerge = {
  counterparties: Counterparty[];
  transactions: Transaction[];
  removedIds: string[];
};

export function planCounterpartyMerge(
  counterparties: Counterparty[],
  transactions: Transaction[],
  timestamp: string,
): CounterpartyMerge {
  const groups = new Map<string, Counterparty[]>();
  for (const entry of counterparties) {
    const key = counterpartyMatchKey(entry.name);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const survivorFor = new Map<string, string>();
  const survivors: Counterparty[] = [];
  const removedIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const ordered = [...group].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
    const [survivor, ...duplicates] = ordered;

    const merged: Counterparty = {
      ...survivor,
      kind: ordered.reduce<Counterparty["kind"]>(
        (kind, entry) => widenKind(kind, entry.kind),
        survivor.kind,
      ),
      openingBalance:
        ordered.reduce((sum, entry) => sum + (entry.openingBalance ?? 0), 0) || undefined,
      phone: ordered.find((entry) => entry.phone)?.phone,
      notes: ordered.find((entry) => entry.notes)?.notes,
      isArchived: ordered.every((entry) => entry.isArchived),
      updatedAt: timestamp,
    };

    survivors.push(merged);
    for (const duplicate of duplicates) {
      survivorFor.set(duplicate.id, merged.id);
      removedIds.push(duplicate.id);
    }
  }

  const repointed = transactions
    .filter((entry) => entry.counterpartyId && survivorFor.has(entry.counterpartyId))
    .map((entry) => ({
      ...entry,
      counterpartyId: survivorFor.get(entry.counterpartyId as string),
      updatedAt: timestamp,
    }));

  return { counterparties: survivors, transactions: repointed, removedIds };
}
